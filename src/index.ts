/**
 * @pockit/ai-core
 * 
 * Lightweight in-browser AI powered by WebLLM
 * React hooks and vanilla JS API for local LLM inference
 */

// React Hook
export { useWebLLM } from './useWebLLM';
export type { 
  WebLLMHook, 
  WebLLMOptions,
  ChatMessage,
  GenerateOptions 
} from './types';

// Vanilla JS API
export { AICore } from './PockitAI';
export type { AICoreOptions, GenerateOptions as AICoreGenerateOptions } from './PockitAI';

// Function Calling Types
export type {
  FunctionParameter,
  FunctionDefinition,
  ToolDefinition,
  FunctionCall,
  FunctionImplementation
} from './types';
