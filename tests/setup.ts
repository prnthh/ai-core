import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let devServer: ChildProcess | null = null;

// Wait for server to be ready
async function waitForServer(url: string, timeout = 30000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        console.log('✓ Dev server is ready');
        return;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error(`Server did not start within ${timeout}ms`);
}

export default async function setup() {
  console.log('Starting dev server...');
  
  // Start the dev server from the docs directory
  const docsPath = path.join(process.cwd(), 'docs');
  
  devServer = spawn('npm', ['run', 'dev'], {
    cwd: docsPath,
    stdio: 'pipe',
    shell: true
  });

  devServer.stdout?.on('data', (data) => {
    console.log(`[DEV SERVER] ${data}`);
  });

  devServer.stderr?.on('data', (data) => {
    console.error(`[DEV SERVER ERROR] ${data}`);
  });

  // Wait for server to be ready
  await waitForServer('http://localhost:5173');
}

export async function teardown() {
  console.log('Stopping dev server...');
  
  if (devServer) {
    devServer.kill('SIGTERM');
    
    // Give it time to shut down gracefully
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (devServer.killed === false) {
      devServer.kill('SIGKILL');
    }
    
    devServer = null;
  }
}
