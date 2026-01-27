/**
 * AICore - Vanilla JavaScript API for WebLLM using Web Workers
 * Use this in non-React contexts
 */

import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { ToolDefinition, FunctionCall, FunctionImplementation } from './types';

export interface AICoreOptions {
  modelId?: string;
  onProgress?: (progress: { text: string; progress: number }) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  onUpdate?: (chunk: string) => void;
  onFinish?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export class AICore {
  private worker: Worker | null = null;
  private modelId: string;
  private isLoaded = false;
  private options: AICoreOptions;
  private conversationHistory: ChatCompletionMessageParam[] = [];
  private currentGenerateOptions: GenerateOptions | null = null;
  private tools: Map<string, FunctionImplementation> = new Map();

  constructor(options: AICoreOptions = {}) {
    this.modelId = options.modelId || 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
    this.options = options;
  }

  /**
   * Initialize and load the model in a Web Worker
   */
  async initialize(): Promise<void> {
    if (this.isLoaded || this.worker) return;

    return new Promise((resolve, reject) => {
      this.worker = new Worker(
        new URL('./webLlmWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.addEventListener('message', (e) => {
        const { type, data } = e.data;

        switch (type) {
          case 'progress':
            this.options.onProgress?.({
              text: data.text,
              progress: data.progress
            });
            break;

          case 'ready':
            this.isLoaded = true;
            this.options.onReady?.();
            resolve();
            break;

          case 'chunk':
            this.currentGenerateOptions?.onUpdate?.(data.chunk);
            break;

          case 'complete':
            this.currentGenerateOptions?.onFinish?.(data.text);
            this.currentGenerateOptions = null;
            break;

          case 'error':
            const error = new Error(data.message);
            this.options.onError?.(error);
            this.currentGenerateOptions?.onError?.(error);
            this.currentGenerateOptions = null;
            reject(error);
            break;
        }
      });

      this.worker.postMessage({ type: 'init', modelId: this.modelId });
    });
  }

  /**
   * Generate a chat response with conversation history
   */
  async chat(
    message: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    if (!this.worker || !this.isLoaded) {
      await this.initialize();
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message
    });

    const response = await this.generate(this.conversationHistory, options);

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response
    });

    return response;
  }

  /**
   * Generate without maintaining conversation history
   */
  async generate(
    messages: ChatCompletionMessageParam[] | string,
    options: GenerateOptions = {}
  ): Promise<string> {
    if (!this.worker || !this.isLoaded) {
      await this.initialize();
    }

    const messageArray = typeof messages === 'string'
      ? [{ role: 'user' as const, content: messages }]
      : messages;

    return new Promise((resolve, reject) => {
      this.currentGenerateOptions = {
        ...options,
        onFinish: (text) => {
          options.onFinish?.(text);
          resolve(text);
        },
        onError: (error) => {
          options.onError?.(error);
          reject(error);
        }
      };

      this.worker!.postMessage({
        type: 'generate',
        messages: messageArray,
        options: {
          temperature: options.temperature,
          maxTokens: options.maxTokens
        }
      });
    });
  }

  /**
   * Reset conversation history
   */
  reset(): void {
    this.conversationHistory = [];
  }

  /**
   * Interrupt ongoing generation
   */
  async interrupt(): Promise<void> {
    this.worker?.postMessage({ type: 'interrupt' });
  }

  /**
   * Get current conversation history
   */
  getHistory(): ChatCompletionMessageParam[] {
    return [...this.conversationHistory];
  }

  /**
   * Set conversation history
   */
  setHistory(history: ChatCompletionMessageParam[]): void {
    this.conversationHistory = [...history];
  }

  /**
   * Register a function that the LLM can call
   */
  registerTool(name: string, implementation: FunctionImplementation): void {
    this.tools.set(name, implementation);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Execute a registered tool
   */
  async executeTool(name: string, parameters: Record<string, any>): Promise<any> {
    const implementation = this.tools.get(name);
    if (!implementation) {
      throw new Error(`Tool '${name}' is not registered`);
    }
    return await implementation(parameters);
  }

  /**
   * Build a system prompt with tool definitions (Llama 3.1 format)
   */
  buildSystemPromptWithTools(
    basePrompt: string,
    tools: ToolDefinition[]
  ): string {
    const toolsJson = tools.map(t => JSON.stringify(t, null, 0)).join('\n');
    
    return `${basePrompt}

You have access to the following functions:
${toolsJson}

When you need to call a function, respond ONLY with:
<function>{"name": "function_name", "parameters": {"param1": "value1"}}</function>

Do not add any other text when calling a function. Put the entire function call on one line.`;
  }

  /**
   * Parse function calls from LLM response (supports Llama 3.1 and Hermes formats)
   */
  parseFunctionCall(response: string): FunctionCall | null {
    // Try Llama 3.1 format: <function>...</function>
    let match = response.match(/<function>(.*?)<\/function>/s);
    
    // Try Hermes format: <tool_call>...</tool_call>
    if (!match) {
      match = response.match(/<tool_call>(.*?)<\/tool_call>/s);
    }
    
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        return {
          name: parsed.name,
          parameters: parsed.parameters || parsed.arguments || {}
        };
      } catch (e) {
        console.error('Failed to parse function call:', e);
        return null;
      }
    }
    return null;
  }

  /**
   * Generate with automatic tool execution loop
   * Handles function calling workflow automatically
   */
  async generateWithTools(
    messages: ChatCompletionMessageParam[],
    options: GenerateOptions & {
      maxToolCalls?: number;
      onToolCall?: (name: string, params: Record<string, any>) => void;
      onToolResult?: (name: string, result: any) => void;
    } = {}
  ): Promise<string> {
    const maxToolCalls = options.maxToolCalls ?? 5;
    let toolCallCount = 0;
    let currentMessages = [...messages];

    while (toolCallCount < maxToolCalls) {
      // Generate response
      const response = await this.generate(currentMessages, {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        onUpdate: options.onUpdate
      });

      // Check for function call
      const functionCall = this.parseFunctionCall(response);
      
      if (!functionCall) {
        // No function call, return final response
        return response;
      }

      // Function call detected
      toolCallCount++;
      options.onToolCall?.(functionCall.name, functionCall.parameters);

      // Add assistant's function call to history
      currentMessages.push({
        role: 'assistant',
        content: response
      });

      // Execute the tool
      try {
        const result = await this.executeTool(
          functionCall.name,
          functionCall.parameters
        );
        
        options.onToolResult?.(functionCall.name, result);

        // Add tool result to messages
        const toolResponse = typeof result === 'string' 
          ? result 
          : JSON.stringify(result);
        
        currentMessages.push({
          role: 'tool',
          content: toolResponse,
          tool_call_id: toolCallCount.toString()
        });
      } catch (error: any) {
        // Add error to messages
        currentMessages.push({
          role: 'tool',
          content: `Error: ${error.message}`,
          tool_call_id: toolCallCount.toString()
        });
      }
    }

    // Max tool calls reached, generate final response
    return this.generate(currentMessages, options);
  }

  /**
   * Unload the model and free resources
   */
  async unload(): Promise<void> {
    if (this.worker) {
      this.worker.postMessage({ type: 'unload' });
      this.worker.terminate();
      this.worker = null;
      this.isLoaded = false;
    }
  }
}
