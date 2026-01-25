/**
 * WebLLM Worker for the example app
 * This is a local worker that uses the parent package
 */

import { MLCEngineInterface, ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import * as webllm from "@mlc-ai/web-llm";

let engine: MLCEngineInterface | null = null;

interface WorkerMessage {
  type: 'init' | 'generate' | 'interrupt' | 'unload';
  modelId?: string;
  messages?: ChatCompletionMessageParam[];
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const { type, modelId, messages, options } = e.data;

  try {
    switch (type) {
      case 'init':
        if (engine) {
          await engine.unload();
        }
        
        engine = await webllm.CreateMLCEngine(modelId || 'Llama-3.2-1B-Instruct-q4f16_1-MLC', {
          initProgressCallback: (progress) => {
            self.postMessage({
              type: 'progress',
              data: {
                text: progress.text,
                progress: progress.progress * 100
              }
            });
          }
        });
        
        self.postMessage({ type: 'ready' });
        break;

      case 'generate':
        if (!engine || !messages) {
          throw new Error('Engine not initialized or no messages provided');
        }

        const chunks = await engine.chat.completions.create({
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? undefined,
          stream: true,
        });

        let fullText = '';
        for await (const chunk of chunks) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            self.postMessage({
              type: 'chunk',
              data: { chunk: content, full: fullText }
            });
          }
        }

        self.postMessage({
          type: 'complete',
          data: { text: fullText }
        });
        break;

      case 'interrupt':
        if (engine) {
          await engine.interruptGenerate();
        }
        break;

      case 'unload':
        if (engine) {
          await engine.unload();
          engine = null;
          self.postMessage({ type: 'unloaded' });
        }
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
});

export {};
