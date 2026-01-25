import { useState, useEffect, useCallback, useRef } from 'react';
import type { WebLLMHook, WebLLMOptions, ChatMessage, GenerateOptions } from './types';

/**
 * React hook for using WebLLM in the browser via Web Worker
 * 
 * @example
 * ```tsx
 * const { isReady, chat } = useWebLLM({
 *   modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
 * });
 * 
 * await chat('Hello!', {
 *   onUpdate: (chunk) => console.log(chunk)
 * });
 * ```
 */
export function useWebLLM(options: WebLLMOptions = {}): WebLLMHook {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const conversationHistoryRef = useRef<ChatMessage[]>([]);
  const currentGenerateOptionsRef = useRef<GenerateOptions | null>(null);

  const modelId = options.modelId || 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

  // Initialize worker on mount
  useEffect(() => {
    const worker = new Worker(new URL('./webLlmWorker.ts', import.meta.url), {
      type: 'module'
    });

    worker.addEventListener('message', (e) => {
      const { type, data } = e.data;

      switch (type) {
        case 'progress':
          setLoadProgress(data.progress);
          options.onProgress?.(data.text, data.progress);
          break;

        case 'ready':
          setIsReady(true);
          setIsLoading(false);
          options.onReady?.();
          break;

        case 'chunk':
          currentGenerateOptionsRef.current?.onUpdate?.(data.chunk);
          break;

        case 'complete':
          currentGenerateOptionsRef.current?.onFinish?.(data.text);
          currentGenerateOptionsRef.current = null;
          break;

        case 'error':
          setError(data.message);
          options.onError?.(data.message);
          currentGenerateOptionsRef.current?.onError?.(data.message);
          currentGenerateOptionsRef.current = null;
          break;

        case 'unloaded':
          setIsReady(false);
          break;
      }
    });

    workerRef.current = worker;

    // Initialize the engine
    setIsLoading(true);
    worker.postMessage({ type: 'init', modelId });

    return () => {
      worker.postMessage({ type: 'unload' });
      worker.terminate();
    };
  }, [modelId]);

  const generate = useCallback(async (
    messages: ChatMessage[],
    genOptions?: GenerateOptions
  ): Promise<string> => {
    if (!workerRef.current || !isReady) {
      throw new Error('Worker not ready');
    }

    return new Promise((resolve, reject) => {
      currentGenerateOptionsRef.current = {
        ...genOptions,
        onFinish: (text) => {
          genOptions?.onFinish?.(text);
          resolve(text);
        },
        onError: (error) => {
          genOptions?.onError?.(error);
          reject(new Error(error));
        }
      };

      workerRef.current!.postMessage({
        type: 'generate',
        messages,
        options: {
          temperature: genOptions?.temperature,
          maxTokens: genOptions?.maxTokens
        }
      });
    });
  }, [isReady]);

  const chat = useCallback(async (
    userMessage: string,
    genOptions?: GenerateOptions
  ): Promise<string> => {
    conversationHistoryRef.current.push({
      role: 'user',
      content: userMessage
    });

    const response = await generate(conversationHistoryRef.current, genOptions);

    conversationHistoryRef.current.push({
      role: 'assistant',
      content: response
    });

    return response;
  }, [generate]);

  const resetConversation = useCallback(() => {
    conversationHistoryRef.current = [];
  }, []);

  const interrupt = useCallback(() => {
    workerRef.current?.postMessage({ type: 'interrupt' });
  }, []);

  const unload = useCallback(async () => {
    workerRef.current?.postMessage({ type: 'unload' });
  }, []);

  return {
    isLoading,
    isReady,
    loadProgress,
    error,
    generate,
    chat,
    resetConversation,
    interrupt,
    unload
  };
}
