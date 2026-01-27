# @pockit/ai-core

> **Embed tiny intelligence directly in your apps** - No separate AI servers needed

Lightweight library for running large language models directly in your applications using WebGPU. Embed AI capabilities in web apps, games (intelligent NPCs!), browser extensions, and Node.js servers without external API calls or separate AI infrastructure.

## Features

- 🧠 **Embedded Intelligence** - Run 1B-3B parameter models directly in your app (client or server)
- 🚫 **No Separate AI Infrastructure** - Eliminate external API calls and separate AI boxes
- 🎮 **Perfect for Game NPCs** - Add intelligent dialogue to characters without backend services
- ⚡ **Fast inference** - Hardware-accelerated with WebGPU
- 🎨 **React-first** - Simple hooks API for web apps
- 🔒 **Private by Default** - All data stays in-process, no external requests
- 📦 **Lightweight** - Minimal dependencies, optimized bundle size
- 🌐 **Universal** - Works in browsers (WebGPU) and Node.js servers
Why Embed AI?

Instead of calling external AI APIs or managing separate AI servers, embed the intelligence directly into your application:

- ✅ **Lower latency** - No network round trips
- ✅ **Reduced costs** - No per-request API charges
- ✅ **Better privacy** - Data never leaves your app
- ✅ **Offline capable** - Works without internet
- ✅ **Simplified architecture** - Fewer moving parts

## 
## Installation

```bash
npm install @pockit/ai-core
```

## Quick Start

### React Hook

```tsx
import { useWebLLM } from '@pockit/ai-core';

function Chat() {
  const { isReady, chat } = useWebLLM({
    modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
  });

  const handleSend = async () => {
    const response = await chat('Hello!');
    console.log(response);
  };

  return (
    <div>
      {isReady ? (
        <button onClick={handleSend}>Send</button>
      ) : (
        <p>Loading model...</p>
      )}
    </div>
  );
}
```

### Vanilla JavaScript

```typescript
import { AICore } from '@pockit/ai-core';

const ai = new AICore({
  modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  onProgress: (p) => console.log(`${p.text} ${p.progress}%`),
  onReady: () => console.log('Ready!')
});

// Initialize
await ai.initialize();

// Chat with history
await ai.chat('Hello!', {
  onUpdate: (chunk) => console.log(chunk),
  onFinish: (full) => console.log('Done:', full)
});

// One-off generation
await ai.generate('What is AI?');
```

## API

### React: `useWebLLM(options)`

**Options:**
- `modelId` - Model name (default: 'Llama-3.2-1B-Instruct-q4f16_1-MLC')
- `onProgress` - Callback for download progress `(text: string, progress: number) => void`
- `onReady` - Callback when model is ready
- `onError` - Error handler

**Returns:**
- `isLoading` - Model is downloading
- `isReady` - Model is ready to use
- `error` - Error message if any
- `generate(messages, options)` - Generate response from message array
- `chat(message, options)` - Send message and maintain conversation history
- `reset()` - Clear conversation history

### Vanilla: `new AICore(options)`

**Options:**
- `modelId` - Model name
- `onProgress` - Callback for download progress
- `onReady` - Callback when ready
- `onError` - Error handler

**Methods:**
- `initialize()` - Load the model
- `chat(message, options)` - Chat with conversation history
- `generate(message, options)` - One-off generation (no history)
- `reset()` - Clear conversation history
- `interrupt()` - Stop generation
- `getHistory()` / `setHistory()` - Manage conversation
- `unload()` - Free resources

**Function Calling Methods:**
- `registerTool(name, implementation)` - Register a function the LLM can call
- `unregisterTool(name)` - Remove a registered tool
- `executeTool(name, params)` - Execute a registered tool
- `buildSystemPromptWithTools(basePrompt, tools)` - Generate system prompt with tool definitions (Llama 3.1 format)
- `parseFunctionCall(response)` - Extract function calls from LLM responses
- `generateWithTools(messages, options)` - Automatic function calling loop

## Function Calling

AICore includes built-in utilities for function calling, supporting Llama 3.1 and Hermes formats:

```typescript
import { AICore, type ToolDefinition } from '@pockit/ai-core';

const ai = new AICore();

// 1. Define tools
const tools: ToolDefinition[] = [{
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' }
      },
      required: ['location']
    }
  }
}];

// 2. Register implementation
ai.registerTool('get_weather', (params) => {
  return `Weather in ${params.location}: Sunny, 72°F`;
});

// 3. Build system prompt with tools
const systemPrompt = ai.buildSystemPromptWithTools(
  "You are a helpful assistant.",
  tools
);

// 4. Use automatic function calling
await ai.initialize();
const response = await ai.generateWithTools([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: 'What\'s the weather in Paris?' }
], {
  onToolCall: (name, params) => console.log('Calling:', name, params),
  onToolResult: (name, result) => console.log('Result:', result)
});
// Response: "The weather in Paris is sunny and 72°F."
```

### Manual Function Calling

For more control, use the parsing utilities:

```typescript
const response = await ai.generate(messages);
const functionCall = ai.parseFunctionCall(response);

if (functionCall) {
  const result = await ai.executeTool(
    functionCall.name,
    functionCall.parameters
  );
  // Add result to conversation and continue...
}
```

## Examples

```typescript
import { AICore } from '@pockit/ai-core';

const npc = new AICore({
  modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
});

await npc.initialize();
npc.setHistory([{
  role: 'system',
  content: 'You are a friendly shopkeeper. Keep responses to 1-2 sentences.'
}]);

const response = await npc.chat('What do you sell?', {
  maxTokens: 50
});
```

### Demo App

See the [docs](./docs) folder for a full demo with three AI characters having a conversation.

Run the example:

```bash
cd docs
npm install
npm run dev
```

## Use Cases

Requires WebGPU support:
- Chrome/Edge 113+
- Safari 18+ (preview)
- Firefox (behind flag)

## Models

Compatible with MLC-compiled models. Popular choices:

- `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (~500MB, fast)
- `Llama-3.2-1B-Instruct-q4f16_1-MLC` (~1GB, better quality)

See [MLC WebLLM](https://github.com/mlc-ai/web-llm) for more models.

## License

MIT

## Credits

Built on top of [MLC WebLLM](https://github.com/mlc-ai/web-llm)
