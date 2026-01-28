/**
 * Example: Function Calling with AICore
 * 
 * This example demonstrates how to use AICore's built-in function calling utilities
 * to create an LLM-powered system that can execute actions.
 */

import { AICore, type ToolDefinition } from "../../../src";

// 1. Initialize AICore
const aiCore = new AICore({
    modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    onProgress: (progress) => console.log(progress.text, progress.progress),
    onReady: () => console.log('Model ready!'),
});

// 2. Define your tools
const tools: ToolDefinition[] = [{
    type: 'function',
    function: {
        name: 'move_character',
        description: 'Move a character to a location',
        parameters: {
            type: 'object',
            properties: {
                character: { type: 'string', description: 'Character name' },
                location: { type: 'string', description: 'Location name' }
            },
            required: ['character', 'location']
        }
    }
}];

// 3. Register tool implementations
aiCore.registerTool('move_character', (params) => {
    console.log(`Moving ${params.character} to ${params.location}`);
    return `${params.character} is now at ${params.location}`;
});

// 4. Build system prompt with tools
const systemPrompt = aiCore.buildSystemPromptWithTools(
    "You are a helpful assistant that manages characters.",
    tools
);

// 5. Use generateWithTools for automatic function calling
async function handleCommand(userCommand: string) {
    await aiCore.initialize();

    const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userCommand }
    ];

    const response = await aiCore.generateWithTools(messages, {
        temperature: 0.3,
        onToolCall: (name, params) => {
            console.log(`🔧 Calling: ${name}`, params);
        },
        onToolResult: (name, result) => {
            console.log(`✓ Result: ${name} ${result}`);
        }
    });

    console.log(`🤖 ${response}`);
}

// Example usage
handleCommand("Move the Pilot to the Bridge");

/**
 * The library handles:
 * - Parsing function calls from LLM responses (Llama 3.1 & Hermes formats)
 * - Executing registered tools
 * - Adding tool results back to conversation
 * - Generating natural language responses
 * 
 * You can also manually parse and execute:
 */

async function manualFunctionCalling() {
    const response = await aiCore.generate([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Send the Doctor to Medbay' }
    ]);

    // Parse function call
    const functionCall = aiCore.parseFunctionCall(response);

    if (functionCall) {
        // Execute tool
        const result = await aiCore.executeTool(
            functionCall.name,
            functionCall.parameters
        );
        console.log(result);
    }
}
