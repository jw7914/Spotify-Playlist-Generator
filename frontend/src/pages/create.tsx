import { useState, useRef, useEffect } from "react";
import {
  Button,
  Input,
  Card,
  CardBody,
  Avatar,
  ScrollShadow,
  Chip,
} from "@heroui/react";
import { Send, Sparkles, Bot, User, Music, Disc3 } from "lucide-react";
import ReactMarkdown from "react-markdown";

// --- Types ---
interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  type?: "text" | "playlist-preview";
  playlistData?: any;
}

// Backend expects this structure for history
interface BackendHistoryItem {
  role: "user" | "model";
  parts: string[];
}

export default function CreateWithAIPage() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial Welcome Message
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content:
        "Hello! I'm your Spotify AI DJ. Tell me what you're feeling, or describe a scenario, and I'll build a playlist for it.",
      type: "text",
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // --- Helper: Convert Frontend Messages to Backend History ---
  const getHistoryForBackend = (
    currentMessages: Message[]
  ): BackendHistoryItem[] => {
    return currentMessages.map((msg) => ({
      role: msg.role === "ai" ? "model" : "user",
      parts: [msg.content],
    }));
  };

  // --- Handle Sending ---
  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. Add User Message to UI
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      type: "text",
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // 2. Prepare Payload
      const payload = {
        message: userMsg.content,
        history: getHistoryForBackend(messages),
      };

      // 3. Call the API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(data);

      // 4. Process AI Response
      const isPlaylistContext =
        data.text.toLowerCase().includes("playlist") ||
        data.text.toLowerCase().includes("track list") ||
        data.text.toLowerCase().includes("songs");

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: data.text,
        type: isPlaylistContext ? "playlist-preview" : "text",
        playlistData: isPlaylistContext
          ? { name: "Generated Mix", trackCount: "20+" } // Placeholder
          : undefined,
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("Chat failed", error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "ai",
        content:
          "Sorry, I'm having trouble connecting to the server right now.",
        type: "text",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const starterPrompts = [
    "Gym workout with high BPM rap",
    "Sad rainy day jazz",
    "Cooking dinner for a date",
    "Roadtrip through the desert 80s style",
  ];

  return (
    <div className="flex flex-col h-screen bg-black text-white selection:bg-purple-500/30 overflow-hidden">
      {/* Main Chat Area */}
      <main className="flex-1 relative flex flex-col max-w-5xl w-full mx-auto p-4 md:p-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="fixed top-20 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="fixed bottom-20 right-10 w-96 h-96 bg-green-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 z-10 shrink-0">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
            <Sparkles className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Playlist Generator</h1>
            <p className="text-xs text-zinc-400">Powered by OpenAI & Spotify</p>
          </div>
        </div>

        {/* Chat History */}
        <ScrollShadow className="flex-1 rounded-2xl bg-zinc-900/30 border border-white/5 backdrop-blur-sm p-4 md:p-6 mb-4 overflow-y-auto">
          <div className="flex flex-col gap-6 min-h-full">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-2xl ${
                  msg.role === "user"
                    ? "self-end flex-row-reverse"
                    : "self-start"
                }`}
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {msg.role === "ai" ? (
                    <Avatar
                      icon={<Bot size={20} />}
                      classNames={{ base: "bg-zinc-800 text-zinc-400" }}
                    />
                  ) : (
                    <Avatar
                      icon={<User size={20} />}
                      classNames={{ base: "bg-green-600 text-black" }}
                    />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col gap-2">
                  <div
                    className={`p-4 rounded-2xl text-sm md:text-base leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#1DB954] text-black rounded-tr-none font-medium"
                        : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700"
                    }`}
                  >
                    <ReactMarkdown
                      components={{
                        // Bold text
                        strong: ({ node, ...props }) => (
                          <span className="font-bold" {...props} />
                        ),
                        // Unordered lists (bullets)
                        ul: ({ node, ...props }) => (
                          <ul
                            className="list-disc pl-4 mb-2 space-y-1"
                            {...props}
                          />
                        ),
                        // List items
                        li: ({ node, ...props }) => (
                          <li className="pl-1" {...props} />
                        ),
                        // Paragraphs
                        p: ({ node, ...props }) => (
                          <p className="mb-2 last:mb-0" {...props} />
                        ),
                        // Headers
                        h3: ({ node, ...props }) => (
                          <h3
                            className="text-lg font-bold mt-3 mb-1"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Rich Media: Playlist Preview Card */}
                  {msg.type === "playlist-preview" && msg.playlistData && (
                    <Card className="max-w-xs bg-black/60 border border-white/10 mt-1">
                      <CardBody className="flex flex-row gap-4 items-center p-3">
                        <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                          <Disc3
                            className="text-white animate-spin-slow"
                            size={20}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">
                            {msg.playlistData.name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {msg.playlistData.trackCount} Songs • Ready to Sync
                          </p>
                        </div>
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          isIconOnly
                        >
                          <Music size={16} />
                        </Button>
                      </CardBody>
                    </Card>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-4 max-w-2xl self-start">
                <Avatar
                  icon={<Bot size={20} />}
                  classNames={{ base: "bg-zinc-800 text-zinc-400" }}
                />
                <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-none border border-zinc-700 flex items-center gap-1 h-[46px]">
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollShadow>

        {/* Suggestions */}
        {messages.length < 3 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide z-10">
            {starterPrompts.map((prompt) => (
              <Chip
                key={prompt}
                as="button"
                variant="flat"
                className="hover:bg-zinc-700 cursor-pointer transition-colors border border-white/5 bg-zinc-800 text-zinc-300 py-4"
                onClick={() => setInput(prompt)}
              >
                {prompt}
              </Chip>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="bg-black z-20">
          <Input
            classNames={{
              input:
                "text-base !text-white placeholder:text-zinc-500 !bg-transparent",
              inputWrapper:
                "bg-zinc-900 border border-zinc-800 data-[hover=true]:bg-zinc-900 focus-within:!bg-zinc-900 focus-within:!border-purple-500/50 rounded-full h-14 pl-6 pr-2 shadow-lg",
              innerWrapper: "gap-3",
            }}
            placeholder="Describe your mood, genre, or activity..."
            value={input}
            onValueChange={setInput}
            onKeyDown={handleKeyDown}
            endContent={
              <Button
                isIconOnly
                radius="full"
                className={`bg-[#1DB954] text-black ${
                  !input.trim() ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send size={18} fill="currentColor" className="ml-0.5" />
              </Button>
            }
          />
          <p className="text-center text-[10px] text-zinc-600 mt-2">
            AI can make mistakes. Please check the playlist before syncing.
          </p>
        </div>
      </main>
    </div>
  );
}
