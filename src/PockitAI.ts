/**
 * AICore - Vanilla JavaScript API for WebLLM using Web Workers
 * Use this in non-React contexts
 */

import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

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
