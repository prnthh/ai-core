import puppeteer, { Browser, Page } from 'puppeteer';

describe('Pockit AICore Example with Puppeteer', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--enable-features=Vulkan,UseSkiaRenderer,WebGPU',
        '--enable-unsafe-webgpu',
        '--use-angle=metal', // Use Metal on macOS
        '--disable-web-security', // Allow WebGPU
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Use the existing page instead of creating a new one
    const pages = await browser.pages();
    page = pages[0];
    
    // Listen to console logs
    page.on('console', msg => {
      const text = msg.text();
      console.log('PAGE:', text);
    });

    await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle0',
      timeout: 10000
    });
  });

  afterEach(async () => {
    // Don't close the page, just navigate away
    if (page) {
      await page.goto('about:blank');
    }
  });

  test('should load model and start conversation', async () => {
    console.log('Checking for page title...');
    const title = await page.title();
    expect(title).toBeTruthy();

    console.log('Waiting for model to load... (this may take 2-3 minutes)');
    
    // Wait for model to be ready (max 5 minutes)
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || '';
        return text.includes('✓ Model loaded');
      },
      { timeout: 300000 }
    );

    console.log('✅ Model loaded! Starting conversation...');

    // Find and click the "Start Conversation" button
    const startButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Start Conversation'));
    });
    
    if (!startButton) throw new Error('Start button not found');
    await (startButton as any).click();

    console.log('Waiting for first message...');
    
    // Wait for at least one message to appear (max 2 minutes for generation)
    await page.waitForFunction(
      () => {
        // Look for any message content - checking for emoji characters that represent the AI personalities
        const pageText = document.body.innerText || '';
        return pageText.includes('🤖') || pageText.includes('🎨') || pageText.includes('🌟');
      },
      { timeout: 120000 }
    );

    console.log('✅ First message generated!');

    // Check that messages are being generated
    const messageCount = await page.evaluate(() => {
      return document.querySelectorAll('[class*="animate-fadeIn"]').length;
    });

    expect(messageCount).toBeGreaterThan(0);
    console.log(`✅ Test passed! Found ${messageCount} messages`);
  }, 360000); // 6 minute timeout total
});
