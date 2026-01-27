import { useState, useEffect, useRef } from "react"

interface Character {
    name: string;
    memory: any[];
    position: { x: number; y: number };
}

interface Location {
    name: string;
    description: string;
    position: { x: number; y: number };
}

interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_call_id?: string;
}

interface FunctionCall {
    name: string;
    parameters: { character: string; location: string };
}

export default function SimGame() {
    const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
    const [characters, setCharacters] = useState<Character[]>([
        { name: "Pilot", memory: [], position: { x: 50, y: 50 } },
        { name: "Doctor", memory: [], position: { x: 200, y: 50 } },
        { name: "Engineer", memory: [], position: { x: 350, y: 50 } },
    ])

    const [locations, setLocations] = useState<Location[]>([
        { name: "Bridge", description: "The control center of the spaceship.", position: { x: 50, y: 200 } },
        { name: "Medbay", description: "Where medical treatments are administered.", position: { x: 200, y: 200 } },
        { name: "Engine Room", description: "Where the ship's engines are maintained.", position: { x: 350, y: 200 } },
    ])

    const [command, setCommand] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const workerRef = useRef<Worker | null>(null);
    const currentGenOptionsRef = useRef<any>(null);

    // Initialize WebLLM worker
    useEffect(() => {
        if (workerRef.current) return;

        const worker = new Worker(new URL('../webLlmWorker.ts', import.meta.url), {
            type: 'module'
        });

        worker.addEventListener('message', (e) => {
            const { type, data } = e.data;

            switch (type) {
                case 'progress':
                    setLoadProgress(data.progress);
                    break;
                case 'ready':
                    setIsReady(true);
                    setIsLoading(false);
                    addLog('✓ Model ready for commands');
                    break;
                case 'chunk':
                    currentGenOptionsRef.current?.onUpdate?.(data.chunk);
                    break;
                case 'complete':
                    currentGenOptionsRef.current?.onFinish?.(data.text);
                    currentGenOptionsRef.current = null;
                    break;
                case 'error':
                    console.error('Worker error:', data.message);
                    currentGenOptionsRef.current?.onError?.(data.message);
                    currentGenOptionsRef.current = null;
                    break;
            }
        });

        workerRef.current = worker;
        worker.postMessage({ type: 'init', modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' });

        return () => {
            // Cleanup on unmount
        };
    }, []);

    // Helper to add logs
    const addLog = (message: string) => {
        setLogs(prev => [...prev, message]);
    };

    // Build system prompt with available tools
    const buildSystemPrompt = (): string => {
        const locationsList = locations.map(l => `${l.name}: ${l.description}`).join('\n');
        const charactersList = characters.map(c => c.name).join(', ');

        return `You are a spaceship AI assistant. You help manage crew members and their locations.

Available characters: ${charactersList}
Available locations:
${locationsList}

You have access to the following function:
{
    "type": "function",
    "function": {
        "name": "move_character",
        "description": "Move a character to a specific location",
        "parameters": {
            "type": "object",
            "properties": {
                "character": {
                    "type": "string",
                    "description": "The name of the character to move"
                },
                "location": {
                    "type": "string",
                    "description": "The name of the location to move to"
                }
            },
            "required": ["character", "location"]
        }
    }
}

When you need to move a character, respond ONLY with:
<function>{"name": "move_character", "parameters": {"character": "CharacterName", "location": "LocationName"}}</function>

Do not add any other text when calling a function.`;
    };

    // Parse function calls from LLM response
    const parseFunctionCall = (response: string): FunctionCall | null => {
        const match = response.match(/<function>(.*?)<\/function>/);
        if (match) {
            try {
                return JSON.parse(match[1]);
            } catch (e) {
                console.error('Failed to parse function call:', e);
                return null;
            }
        }
        return null;
    };

    // Execute the move_character function
    const executeMoveCharacter = (characterName: string, locationName: string): string => {
        const char = characters.find(c => c.name === characterName);
        const loc = locations.find(l => l.name === locationName);

        if (!char) {
            return `Error: Character "${characterName}" not found`;
        }
        if (!loc) {
            return `Error: Location "${locationName}" not found`;
        }

        // Update character position
        setCharacters(prev => prev.map(c =>
            c.name === characterName
                ? { ...c, position: { ...loc.position } }
                : c
        ));

        return `Successfully moved ${characterName} to ${locationName}`;
    };

    // Handle command submission
    const handleCommandSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || !isReady || isProcessing) return;

        const userCommand = command.trim();
        setCommand("");
        setIsProcessing(true);
        addLog(`> ${userCommand}`);

        try {
            const messages: Message[] = [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user', content: userCommand }
            ];

            // Generate response
            const response = await new Promise<string>((resolve, reject) => {
                let fullResponse = '';

                currentGenOptionsRef.current = {
                    onUpdate: (chunk: string) => {
                        fullResponse += chunk;
                    },
                    onFinish: (text: string) => {
                        resolve(text);
                    },
                    onError: (error: string) => {
                        reject(error);
                    }
                };

                workerRef.current?.postMessage({
                    type: 'generate',
                    messages: messages,
                    options: {
                        temperature: 0.3,
                        maxTokens: 150
                    }
                });
            });

            // Check for function call
            const functionCall = parseFunctionCall(response);

            if (functionCall && functionCall.name === 'move_character') {
                const { character, location } = functionCall.parameters;
                addLog(`🔧 Calling: move_character(${character}, ${location})`);

                const result = executeMoveCharacter(character, location);
                addLog(`✓ ${result}`);

                // Get natural language response after executing function
                messages.push({ role: 'assistant', content: response });
                messages.push({ role: 'tool', content: result, tool_call_id: '0' });

                const finalResponse = await new Promise<string>((resolve, reject) => {
                    currentGenOptionsRef.current = {
                        onUpdate: () => { },
                        onFinish: (text: string) => resolve(text),
                        onError: (error: string) => reject(error)
                    };

                    workerRef.current?.postMessage({
                        type: 'generate',
                        messages: messages,
                        options: { temperature: 0.3, maxTokens: 100 }
                    });
                });

                addLog(`🤖 ${finalResponse.trim()}`);
            } else {
                // No function call, just show response
                addLog(`🤖 ${response.trim()}`);
            }
        } catch (error) {
            addLog(`❌ Error: ${error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return <div className="relative w-full h-screen bg-zinc-950 text-white p-6">
        {/* Status Bar */}
        <div className="absolute top-4 left-4 bg-zinc-900 rounded-lg p-3 border border-zinc-800 text-sm">
            <div className="font-semibold mb-1">Function Calling Demo</div>
            {isLoading ? (
                <div>
                    <div className="bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-1 w-48">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                            style={{ width: `${loadProgress}%` }}
                        />
                    </div>
                    <div className="text-xs text-zinc-400">Loading model... {loadProgress.toFixed(0)}%</div>
                </div>
            ) : (
                <div className="text-xs text-green-400">✓ Model ready</div>
            )}
            {selectedCharacter && (
                <div className="text-xs text-zinc-400 mt-2">Selected: {selectedCharacter}</div>
            )}
        </div>

        {/* Game Area */}
        <div className="absolute top-20 left-4 right-4 bottom-64 bg-zinc-900 rounded-lg border border-zinc-800">
            {/* Locations */}
            {locations.map((loc, index) => (
                <Location key={index} location={loc} />
            ))}

            {/* Characters */}
            {characters.map((char, index) => (
                <Character
                    key={index}
                    character={char}
                    isSelected={selectedCharacter === char.name}
                    onSelect={() => setSelectedCharacter(char.name)}
                />
            ))}
        </div>

        {/* Log Panel */}
        <div className="absolute bottom-20 left-4 right-4 h-48 bg-zinc-900 rounded-lg border border-zinc-800 p-4 overflow-y-auto">
            <div className="text-xs font-semibold text-zinc-400 mb-2">Command Log</div>
            <div className="space-y-1 font-mono text-xs">
                {logs.length === 0 ? (
                    <div className="text-zinc-500">Try: "Send the Pilot to the Bridge"</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="text-zinc-300">{log}</div>
                    ))
                )}
            </div>
        </div>

        {/* Command Input */}
        <form onSubmit={handleCommandSubmit} className="absolute bottom-4 left-4 right-4">
            <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter a command (e.g., 'Move the Doctor to Medbay')"
                disabled={!isReady || isProcessing}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
        </form>
    </div>
}

const Character = ({ character, isSelected, onSelect }: { character: Character, isSelected: boolean, onSelect: () => void }) => {
    return (
        <div
            onClick={onSelect}
            className={`absolute cursor-pointer transition-all hover:scale-110 ${isSelected ? 'ring-2 ring-indigo-500 rounded-full' : ''}`}
            style={{
                top: character.position.y,
                left: character.position.x,
                transform: 'translate(-50%, -50%)'
            }}
        >
            <div className="text-4xl">👩‍✈️</div>
            <div className="text-xs text-center mt-1 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {character.name}
            </div>
        </div>
    )
}

const Location = ({ location }: { location: Location }) => {
    return (
        <div
            className="absolute"
            style={{
                top: location.position.y,
                left: location.position.x,
                transform: 'translate(-50%, -50%)'
            }}
        >
            <div className="text-5xl opacity-30">📍</div>
            <div className="text-xs text-center mt-1 text-zinc-500 font-semibold">
                {location.name}
            </div>
        </div>
    )
}