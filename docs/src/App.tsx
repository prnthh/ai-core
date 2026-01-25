import { useState, useCallback, useEffect, useRef } from 'react';

interface Character {
  emoji: string;
  name: string;
  personality: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CHARACTERS: Character[] = [
  { emoji: '🤖', name: 'RoboTech', personality: 'logical and technical' },
  { emoji: '🎨', name: 'ArtSoul', personality: 'creative and imaginative' },
  { emoji: '🌟', name: 'StarWise', personality: 'philosophical and curious' },
];

const TOPICS = [
  'the meaning of creativity',
  'how technology shapes society',
  'the nature of consciousness',
  'art and science intersecting',
  'the future of humanity',
  'dreams and their significance',
];

const DEFAULT_SYSTEM_PROMPT = `{topic}`;
const DEFAULT_FOLLOWUP_PROMPT = `{previous}`;

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState<'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' | 'Llama-3.2-1B-Instruct-q4f16_1-MLC'>('Llama-3.2-1B-Instruct-q4f16_1-MLC');
  const [messages, setMessages] = useState<Array<{ character: Character; text: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [followupPrompt, setFollowupPrompt] = useState(DEFAULT_FOLLOWUP_PROMPT);

  const workerRef = useRef<Worker | null>(null);
  const currentGenOptionsRef = useRef<any>(null);
  const shouldContinueRef = useRef(false);

  // Initialize worker
  useEffect(() => {
    // Prevent double initialization - check if worker already exists
    if (workerRef.current) {
      console.log('Worker already initialized, skipping');
      return;
    }

    console.log('Creating new worker...');
    const worker = new Worker(new URL('./webLlmWorker.ts', import.meta.url), {
      type: 'module'
    });

    worker.addEventListener('message', (e) => {
      const { type, data } = e.data;

      switch (type) {
        case 'progress':
          console.log('Progress:', data.progress.toFixed(1) + '%');
          setLoadProgress(data.progress);
          break;

        case 'ready':
          console.log('✅ Model ready!');
          setIsReady(true);
          setIsLoading(false);
          break;

        case 'chunk':
          currentGenOptionsRef.current?.onUpdate?.(data.chunk);
          break;

        case 'complete':
          currentGenOptionsRef.current?.onFinish?.(data.text);
          currentGenOptionsRef.current = null;
          break;

        case 'error':
          console.error('❌ Worker error:', data.message);
          currentGenOptionsRef.current?.onError?.(data.message);
          currentGenOptionsRef.current = null;
          break;
      }
    });

    workerRef.current = worker;
    console.log('Initializing worker with Llama-3.2-1B...');
    worker.postMessage({ type: 'init', modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' });

    return () => {
      // Don't cleanup unless we're actually unmounting
      console.log('⚠️ Cleanup called - component unmounting');
    };
  }, []);

  const generateNext = useCallback(async () => {
    console.log('generateNext called, isReady:', isReady, 'isRunning:', isRunning);
    if (!isReady || !isRunning) {
      console.log('Skipping generation - not ready or not running');
      return;
    }

    const characterIndex = conversationHistory.length % CHARACTERS.length;
    const character = CHARACTERS[characterIndex];
    console.log('Generating for character:', character.name);

    let userPrompt: string;
    if (conversationHistory.length === 0) {
      userPrompt = systemPrompt.replace('{topic}', currentTopic);
    } else {
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      userPrompt = followupPrompt
        .replace('{topic}', currentTopic)
        .replace('{previous}', lastMessage.content);
    }

    console.log('User prompt:', userPrompt);

    return new Promise<string>((resolve) => {
      let fullResponse = '';

      currentGenOptionsRef.current = {
        onUpdate: (chunk: string) => {
          fullResponse += chunk;
          setCurrentText(fullResponse);
        },
        onFinish: (text: string) => {
          // Clean up response
          let cleaned = text
            .replace(/^.*?Cutting Knowledge Date:.*?$/gm, '')
            .replace(/^.*?Today Date:.*?$/gm, '')
            .replace(/<think>.*$/gs, '')
            .replace(/\b(user|assistant|system)\s*/gi, '')
            .replace(/^\s*[:]\s*/gm, '')
            .trim();

          setMessages(prev => [...prev, { character, text: cleaned }]);
          setConversationHistory(prev => [...prev, { role: 'assistant' as const, content: cleaned }]);
          setCurrentText('');
          shouldContinueRef.current = true;

          resolve(cleaned);
        },
        onError: (error: string) => {
          console.error('Generation error:', error);
          setIsRunning(false);
          resolve('');
        }
      };

      const messagesToSend = [...conversationHistory, { role: 'user' as const, content: userPrompt }];
      workerRef.current?.postMessage({
        type: 'generate',
        messages: messagesToSend,
        options: {
          temperature: 0.7,
          maxTokens: 80
        }
      });
    });
  }, [isReady, isRunning, conversationHistory, currentTopic, systemPrompt, followupPrompt]);

  const startConversation = () => {
    if (!isReady) return;

    // Reset state
    setMessages([]);
    setCurrentText('');
    setConversationHistory([]);

    // Pick random topic
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    setCurrentTopic(topic);
    setIsRunning(true);

    // Start first generation - will be triggered by useEffect below
  };

  const stopConversation = () => {
    setIsRunning(false);
    workerRef.current?.postMessage({ type: 'interrupt' });
  };

  // Auto-start generation when conversation starts
  useEffect(() => {
    if (isRunning && conversationHistory.length === 0 && currentTopic) {
      console.log('Auto-starting first generation...');
      setTimeout(() => generateNext(), 100);
    }
  }, [isRunning, currentTopic, conversationHistory.length, generateNext]);

  // Continue conversation after each message
  useEffect(() => {
    if (shouldContinueRef.current && isRunning && conversationHistory.length > 0 && conversationHistory.length < 8) {
      shouldContinueRef.current = false;
      setTimeout(() => generateNext(), 2000);
    } else if (shouldContinueRef.current && conversationHistory.length >= 8) {
      shouldContinueRef.current = false;
      setIsRunning(false);
    }
  }, [conversationHistory.length, isRunning, generateNext]);

  const resetState = () => {
    setMessages([]);
    setCurrentText('');
    setConversationHistory([]);
    setCurrentTopic('');
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            🎮 Pockit AICore
          </h1>
          <p className="text-zinc-400">Three AI characters having a conversation</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Settings */}
          <div className="space-y-6">
            {/* Model Selection */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h2 className="font-semibold mb-3">Model</h2>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                disabled={isReady || isLoading}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 mb-3"
              >
                <option value="Qwen2.5-0.5B-Instruct-q4f16_1-MLC">Qwen 0.5B (fast)</option>
                <option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">Llama 3.2 1B (better)</option>
              </select>

              {isReady ? (
                <div className="text-sm text-green-400">✓ Model loaded</div>
              ) : isLoading ? (
                <div className="mt-3">
                  <div className="bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-zinc-400">Loading model... {loadProgress.toFixed(0)}%</div>
                </div>
              ) : (
                <div className="text-sm text-zinc-400">Model will load automatically</div>
              )}
            </div>

            {/* Prompts */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h2 className="font-semibold mb-3">Prompts</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Initial (use {'{topic}'})
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono"
                    rows={2}
                    disabled={isRunning}
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Follow-up (use {'{topic}'}, {'{previous}'})
                  </label>
                  <textarea
                    value={followupPrompt}
                    onChange={(e) => setFollowupPrompt(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono"
                    rows={3}
                    disabled={isRunning}
                  />
                </div>

                <button
                  onClick={() => {
                    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
                    setFollowupPrompt(DEFAULT_FOLLOWUP_PROMPT);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                  disabled={isRunning}
                >
                  Reset defaults
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h2 className="font-semibold mb-3">Controls</h2>

              <div className="space-y-2">
                {!isRunning ? (
                  <button
                    onClick={startConversation}
                    disabled={!isReady}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded font-medium hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Conversation
                  </button>
                ) : (
                  <button
                    onClick={stopConversation}
                    className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded font-medium hover:-translate-y-0.5 transition-transform"
                  >
                    Stop
                  </button>
                )}

                <button
                  onClick={resetState}
                  disabled={isRunning}
                  className="w-full border border-zinc-700 text-zinc-300 px-4 py-2 rounded font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
              </div>

              {currentTopic && (
                <div className="mt-3 text-xs text-zinc-400">
                  Topic: <span className="text-zinc-300">{currentTopic}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Conversation */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 min-h-[600px] max-h-[600px] overflow-y-auto">
              {messages.length === 0 && !currentText && (
                <div className="text-center text-zinc-500 py-12">
                  {isReady ? 'Click "Start Conversation" to begin' : isLoading ? 'Loading model...' : 'Model will load automatically'}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className="flex gap-3 mb-4 animate-fadeIn">
                  <div className="text-3xl flex-shrink-0">{msg.character.emoji}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-xs text-zinc-400 mb-1">
                      {msg.character.name}
                    </div>
                    <div className="text-zinc-200 leading-relaxed">{msg.text}</div>
                  </div>
                </div>
              ))}

              {currentText && (
                <div className="flex gap-3 mb-4 animate-fadeIn">
                  <div className="text-3xl flex-shrink-0">
                    {CHARACTERS[messages.length % CHARACTERS.length].emoji}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-xs text-zinc-400 mb-1">
                      {CHARACTERS[messages.length % CHARACTERS.length].name}
                    </div>
                    <div className="text-zinc-200 leading-relaxed opacity-70">{currentText}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
