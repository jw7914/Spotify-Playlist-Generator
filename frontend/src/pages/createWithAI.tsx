import { useState, useRef, useEffect } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody } from "@heroui/card";
import { Avatar } from "@heroui/avatar";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { Send, Sparkles, Bot, User, Music, Disc3 } from "lucide-react";

// Types for our chat state
interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  type?: "text" | "playlist-preview"; // To support rich media responses
  playlistData?: any; // Mock data for a generated playlist
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
  }, [messages]);

  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      type: "text",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // --- SIMULATE AI RESPONSE (Replace this with your actual API call) ---
    setTimeout(() => {
      const isPlaylistRequest =
        userMsg.content.toLowerCase().includes("playlist") ||
        userMsg.content.toLowerCase().includes("songs");

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: isPlaylistRequest
          ? "I've curated a mix based on that vibe. Here is 'Neon Drive' - a collection of synthwave and night pop."
          : "I can definitely help with that. Could you be a bit more specific? For example, are you looking for high energy or something to relax to?",
        type: isPlaylistRequest ? "playlist-preview" : "text",
        playlistData: isPlaylistRequest
          ? { name: "Neon Drive", trackCount: 24 }
          : undefined,
      };

      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
    // ---------------------------------------------------------------------
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
      {/* Main Chat Area - fills remaining height */}
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
                className={`flex gap-4 max-w-2xl ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}
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
                    {msg.content}
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

        {/* Suggestions (Only show if chat is empty-ish) */}
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
              input: "text-base text-white placeholder:text-zinc-500",
              inputWrapper:
                "bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 focus-within:!bg-zinc-900 focus-within:!border-purple-500/50 rounded-full h-14 pl-6 pr-2 transition-all shadow-lg",
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
                className={`bg-[#1DB954] text-black ${!input.trim() ? "opacity-50 cursor-not-allowed" : "hover:scale-105"}`}
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
