export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  onUpdate?: (chunk: string) => void;
  onFinish?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export interface WebLLMOptions {
  modelId?: string;
  onProgress?: (text: string, progress: number) => void;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export interface WebLLMHook {
  isLoading: boolean;
  isReady: boolean;
  loadProgress: number;
  error: string | null;
  generate: (messages: ChatMessage[], options?: GenerateOptions) => Promise<string>;
  chat: (userMessage: string, options?: GenerateOptions) => Promise<string>;
  resetConversation: () => void;
  interrupt: () => void;
  unload: () => Promise<void>;
}
