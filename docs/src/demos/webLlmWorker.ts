/**
 * WebLLM Worker for the example app
 * This is a local worker that uses the parent package
 */

import { MLCEngineInterface, ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import * as webllm from "@mlc-ai/web-llm";

let engine: MLCEngineInterface | null = null;

self.addEventListener('message', async (e) => {
    const { type, modelId, messages, options } = e.data;

    try {
        switch (type) {
            case 'init':
                if (engine) {
                    self.postMessage({ type: 'ready' });
                    return;
                }

                engine = await webllm.CreateMLCEngine(modelId, {
                    initProgressCallback: (report: webllm.InitProgressReport) => {
                        self.postMessage({
                            type: 'progress',
                            data: { progress: report.progress * 100 }
                        });
                    },
                    logLevel: 'ERROR'
                });

                self.postMessage({ type: 'ready' });
                break;

            case 'generate':
                if (!engine) {
                    self.postMessage({
                        type: 'error',
                        data: { message: 'Engine not initialized' }
                    });
                    return;
                }

                const request: webllm.ChatCompletionRequest = {
                    stream: true,
                    messages: messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens ?? 256,
                };

                let fullText = '';
                const chunks = await engine.chat.completions.create(request);
                
                for await (const chunk of chunks) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        fullText += content;
                        self.postMessage({
                            type: 'chunk',
                            data: { chunk: content }
                        });
                    }
                }

                self.postMessage({
                    type: 'complete',
                    data: { text: fullText }
                });
                break;

            case 'interrupt':
                // WebLLM doesn't have direct interrupt, but we can reset conversation
                break;
        }
    } catch (error: any) {
        self.postMessage({
            type: 'error',
            data: { message: error?.message || 'Unknown error' }
        });
    }
});
