export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  onUpdate?: (chunk: string) => void;
  onFinish?: (fullText: string) => void;
  onError?: (error: string) => void;
}

// Function Calling Types
export interface FunctionParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: FunctionParameter;
  properties?: Record<string, FunctionParameter>;
  required?: string[];
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, FunctionParameter>;
    required?: string[];
  };
}

export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}

export interface FunctionCall {
  name: string;
  parameters: Record<string, any>;
}

export type FunctionImplementation = (params: Record<string, any>) => any | Promise<any>;

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
