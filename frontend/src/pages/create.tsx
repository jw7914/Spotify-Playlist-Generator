import { useState, useRef, useEffect } from "react";
import {
  Button,
  Input,
  Card,
  CardBody,
  Avatar,
  ScrollShadow,
  Chip,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  useDisclosure,
  Listbox,
  ListboxItem,
  Autocomplete,
  AutocompleteItem,
  Divider,
} from "@heroui/react";
import { Send, Sparkles, Bot, User, Music, Disc3, History, Plus, Trash2, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { api, Message } from "../services/api";

// Backend expects this structure for history
interface BackendHistoryItem {
  role: "user" | "model";
  parts: string[];
}

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

export default function CreateWithAIPage() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Session State
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Initial Welcome Message
  const WELCOME_MESSAGE: Message = {
    id: "1",
    role: "ai",
    content: "Hello! I'm your Spotify AI DJ. Tell me what you're feeling, or describe a scenario, and I'll build a playlist for it.",
    type: "text",
  };
  
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch User and Sessions on Mount
  useEffect(() => {
    const init = async () => {
      try {
        const userData = await api.spotify.getMe();
        if (userData && userData.user) {
            setUser(userData.user);
            loadSessions(userData.user.id);
        }
      } catch (e) {
        console.error("Failed to init", e);
      }
    };
    init();
  }, []);

  const loadSessions = async (userId: string) => {
      try {
          const data = await api.gemini.getSessions(userId);
          setSessions(data);
      } catch (e) {
          console.error("Failed to load sessions", e);
      }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // --- Helper: Convert Frontend Messages to Backend History ---
  const getHistoryForBackend = (
    currentMessages: Message[],
  ): BackendHistoryItem[] => {
    return currentMessages
      .filter(msg => msg.id !== "1") // Exclude welcome message
      .map((msg) => ({
        role: msg.role === "ai" ? "model" : "user",
        parts: [msg.content],
    }));
  };

  // --- Handle opening spotify playlist ---
  const handleOpenPlaylist = (playlistId: string) => {
    if (!playlistId) return;
    const spotifyUrl = `https://open.spotify.com/playlist/${playlistId}`;
    window.open(spotifyUrl, "_blank", "noopener,noreferrer");
  };

  // --- Session Management ---
  const handleNewChat = () => {
      setCurrentSessionId(null);
      setMessages([WELCOME_MESSAGE]);
      setInput("");
      // Close drawer if on mobile? 
      // For now keep it open or let user close
  };

  const handleDeleteSession = async (sessionId: string) => {
      try {
          await api.gemini.deleteSession(sessionId);
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          
          // If deleted session was active, reset to new chat
          if (currentSessionId === sessionId) {
              handleNewChat();
          }
      } catch (e) {
          console.error("Failed to delete session", e);
      }
  };

  const handleSessionSelect = async (sessionId: string) => {
      setIsLoading(true);
      try {
          // Fetch messages
          const msgs = await api.gemini.getSessionMessages(sessionId);
          
          // Convert to frontend format
          const formattedMessages: Message[] = msgs.map(m => ({
              id: m.id,
              role: m.role === "model" ? "ai" : "user",
              content: m.content,
              type: "text" // Default to text, parsing for playlist could be added if stored in DB specifically
          }));
          
          setMessages([WELCOME_MESSAGE, ...formattedMessages]);
          setCurrentSessionId(sessionId);
      } catch (e) {
          console.error("Failed to load session messages", e);
      } finally {
          setIsLoading(false);
      }
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

    let activeSessionId = currentSessionId;

    try {
      // 1.5 Create Session if needed
      if (!activeSessionId && user) {
          try {
            const newSession = await api.gemini.createSession(user.id, userMsg.content.substring(0, 30));
            activeSessionId = newSession.id;
            setCurrentSessionId(activeSessionId);
            setSessions(prev => [newSession, ...prev]);
          } catch(e) {
              console.error("Failed to create session, proceeding without saving", e);
          }
      }

      // 2. Prepare History
      const history = getHistoryForBackend(newMessages);

      // 3. Call the API
      const data = await api.gemini.chat(userMsg.content, history, activeSessionId || undefined);

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
          ? { name: "Generated Mix", trackCount: "20+", id: data.playlist_id } // Placeholder
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
    <div className="flex flex-col h-[calc(100dvh-64px)] bg-black text-white selection:bg-purple-500/30 overflow-hidden">
      {/* Main Chat Area */}
      <main className="flex-1 relative flex flex-col max-w-5xl w-full mx-auto p-4 md:p-6 overflow-hidden h-full">
        {/* Background Gradients */}
        <div className="fixed top-20 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="fixed bottom-20 right-10 w-96 h-96 bg-green-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 z-10 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
                <Sparkles className="text-white" size={20} />
             </div>
             <div>
                <h1 className="text-xl font-bold">AI Playlist Generator</h1>
                <p className="text-xs text-zinc-400">Powered by Gemini & Spotify</p>
             </div>
          </div>
          {user && (
            <Button 
                isIconOnly 
                className="bg-[#1DB954] text-black" 
                onPress={onOpen}
                isDisabled={isLoading}
            >
                <History size={20} />
            </Button>
          )}
        </div>

        {/* Chat History */}
        <ScrollShadow className="flex-1 rounded-2xl bg-zinc-900/30 border border-white/5 backdrop-blur-sm p-4 md:p-6 mb-4 overflow-y-auto">
          <div className="flex flex-col gap-6 min-h-0">
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
                      src={user?.images?.[0]?.url}
                      icon={<User size={20} />}
                      classNames={{ base: "bg-green-600 text-black" }}
                    />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col gap-2">
                  <div
                    className={`p-4 rounded-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap break-all ${
                      msg.role === "user"
                        ? "bg-[#1DB954] text-black rounded-tr-none font-medium"
                        : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700"
                    }`}
                  >
                    <ReactMarkdown
                      components={{
                        strong: ({ node, ...props }) => (
                          <span className="font-bold" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul
                            className="list-disc pl-4 mb-2 space-y-1"
                            {...props}
                          />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="pl-1" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="mb-2 last:mb-0" {...props} />
                        ),
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
                          onClick={() =>
                            handleOpenPlaylist(msg.playlistData!.id)
                          }
                          isDisabled={!msg.playlistData.id}
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
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide z-10 shrink-0">
            {starterPrompts.map((prompt) => (
              <Chip
                key={prompt}
                as="button"
                isDisabled={isLoading}
                variant="flat"
                className={`hover:bg-zinc-700 cursor-pointer transition-colors border border-white/5 bg-zinc-800 text-zinc-300 py-4 ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => !isLoading && setInput(prompt)}
              >
                {prompt}
              </Chip>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="bg-black z-20 shrink-0">
          <Input
            classNames={{
              input:
                "text-base !text-white placeholder:text-zinc-500 !bg-transparent",
              inputWrapper:
                "bg-zinc-900 border border-zinc-800 data-[hover=true]:bg-zinc-900 focus-within:!bg-zinc-900 focus-within:!border-purple-500/50 rounded-full h-14 pl-6 pr-2 shadow-lg",
              innerWrapper: "gap-3",
            }}
            placeholder={isLoading ? "AI is thinking..." : "Describe your mood, genre, or activity..."}
            value={input}
            onValueChange={setInput}
            onKeyDown={handleKeyDown}
            isDisabled={isLoading}
            endContent={
              <Button
                isIconOnly
                radius="full"
                className={`bg-[#1DB954] text-black ${
                  !input.trim() || isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                isLoading={isLoading}
              >
                {!isLoading && <Send size={18} fill="currentColor" className="ml-0.5" />}
              </Button>
            }
          />
          <p className="text-center text-[10px] text-zinc-600 mt-2">
            AI can make mistakes. Please check the playlist before syncing.
          </p>
        </div>
      </main>

      {/* History Drawer */}
      <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement="left" backdrop="blur">
        <DrawerContent className="bg-zinc-900 text-white border-r border-white/10 max-w-sm w-full">
          {(onClose) => (
            <>
              <DrawerHeader className="flex items-center justify-between border-b border-white/10 pb-4">
                  History
              </DrawerHeader>
              <DrawerBody className="p-0">
                  <div className="p-4 pb-0 flex flex-col gap-4">
                      <Button 
                        fullWidth 
                        className="bg-[#1DB954] text-black font-bold"
                        startContent={<Plus size={18} />}
                        onPress={() => {
                            handleNewChat();
                            onClose();
                        }}
                      >
                        New Chat
                      </Button>
                      
                      <Divider className="my-2 bg-white/10" />

                      <Autocomplete 
                        aria-label="Search History"
                        placeholder="Search chats..."
                        startContent={<Search size={16} className="text-zinc-400" />}
                        defaultItems={sessions}
                        variant="bordered"
                        classNames={{
                           base: "max-w-full",
                           listboxWrapper: "max-h-[320px]",
                           selectorButton: "text-zinc-500"
                        }}
                        inputProps={{
                          classNames: {
                            input: "ml-1",
                            inputWrapper: "border-zinc-700 bg-black/20 hover:border-zinc-500 text-white",
                          },
                        }}
                        listboxProps={{
                          hideSelectedIcon: true,
                          itemClasses: {
                            base: [
                              "text-white",
                              "data-[hover=true]:bg-zinc-800",
                              "data-[hover=true]:text-white",
                              "data-[selectable=true]:focus:bg-zinc-800",
                              "data-[focus-visible=true]:ring-zinc-500",
                            ],
                          },
                        }}
                        popoverProps={{
                           classNames: {
                               base: "bg-zinc-900 border border-zinc-800",
                               content: "bg-zinc-900 border border-zinc-800",
                           }
                        }}
                        onSelectionChange={(key) => {
                            if (key) {
                                handleSessionSelect(String(key));
                                onClose();
                            }
                        }}
                      >
                        {(item) => (
                          <AutocompleteItem key={item.id} textValue={item.title}>
                            <div className="flex flex-col">
                              <span className="text-sm truncate">{item.title}</span>
                              <span className="text-[10px] text-zinc-500">{new Date(item.updated_at).toLocaleDateString()}</span>
                            </div>
                          </AutocompleteItem>
                        )}
                      </Autocomplete>

                      <Divider className="my-2 bg-white/10" />
                  </div>
                  <ScrollShadow className="h-full p-2">
                          <Listbox 
                          aria-label="Chat History"
                          items={sessions}
                          classNames={{
                              list: "gap-2"
                          }}
                          emptyContent={<div className="text-zinc-500 text-center py-4">No recent history</div>}
                      >
                          {(item) => (
                              <ListboxItem
                                  key={item.id}
                                  className={`data-[hover=true]:bg-white/10 data-[hover=true]:text-white ${currentSessionId === item.id ? "bg-white/10" : ""}`}
                                  startContent={<History size={16} className="text-zinc-400 shrink-0" />}
                                  endContent={
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light" 
                                      className="text-zinc-500 hover:text-red-500 min-w-8 w-8 h-8"
                                      onPress={() => handleDeleteSession(item.id)}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  }
                                  onPress={() => {
                                      handleSessionSelect(item.id);
                                      onClose();
                                  }}
                              >
                                  <div className="flex flex-col min-w-0">
                                      <span className="text-sm truncate block">{item.title}</span>
                                      <span className="text-[10px] text-zinc-500">{new Date(item.updated_at).toLocaleDateString()}</span>
                                  </div>
                              </ListboxItem>
                          )}
                      </Listbox>
                  </ScrollShadow>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
