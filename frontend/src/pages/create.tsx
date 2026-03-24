import { useState, useRef, useEffect } from "react";
import {
  Button,
  Textarea,
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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Send, Sparkles, Bot, User, Music, Disc3, History, Plus, Trash2, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams, Link } from "react-router-dom";

import { api, Message } from "../services/api";
import { useAuth } from "@/hooks/useAuth";

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
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Session State
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isReviewOpen, onOpen: onReviewOpen, onOpenChange: onReviewOpenChange } = useDisclosure();
  const [reviewPlaylist, setReviewPlaylist] = useState<any>(null);

  // Redirect if not logged in but trying to access a specific session
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && sessionId) {
      navigate("/create", { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, sessionId, navigate]);

  const handleRemoveTrack = (indexToRemove: number) => {
      setReviewPlaylist((prev: any) => {
          if (!prev) return prev;
          
          const filtered = {
              ...prev,
              tracks_display: prev.tracks_display.filter((_: any, i: number) => i !== indexToRemove),
              track_ids: prev.track_ids.filter((_: any, i: number) => i !== indexToRemove)
          };
          
          // Sync it back to the messages array so the outer chat buttons have the updated payload
          setMessages((msgs) => msgs.map((m, idx) => {
              if (m.isAwaitingConfirmation && m.pendingPlaylist && idx === msgs.length - 1) {
                  return { ...m, pendingPlaylist: filtered };
              }
              return m;
          }));

          return filtered;
      });
  };

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

  // Fetch User and Sessions on Mount / URL Change
  useEffect(() => {
    const initialize = async () => {
      if (user) {
        // Only load sessions list if we haven't already or if it's the first time
        if (sessions.length === 0) {
            await loadSessions(user.id);
        }
        
        if (sessionId) {
            if (sessionId !== currentSessionId) {
                await loadSessionData(sessionId);
            }
        } else {
            if (currentSessionId !== null) {
                handleNewChat(false);
            }
        }
      }
    };
    initialize();
  }, [user, sessionId]);

  const loadSessions = async (userId: string) => {
      try {
          const data = await api.gemini.getSessions(userId);
          setSessions(data);
      } catch (e) {
          console.error("Failed to load sessions", e);
      }
  };

  const loadSessionData = async (sid: string) => {
      setIsLoading(true);
      try {
          const data = await api.gemini.getSessionMessages(sid);
          const msgs = data.messages;
          
          const formattedMessages: Message[] = msgs.map((m, index) => {
              const baseMsg: Message = {
                  id: m.id,
                  role: m.role === "model" ? "ai" : "user",
                  content: m.content,
                  type: "text"
              };
              
              if (index === msgs.length - 1 && baseMsg.role === "ai") {
                  baseMsg.isAwaitingConfirmation = data.is_awaiting_confirmation;
                  baseMsg.pendingPlaylist = data.pending_playlist;
              }
              return baseMsg;
          });
          
          setMessages([WELCOME_MESSAGE, ...formattedMessages]);
          setCurrentSessionId(sid);
      } catch (e) {
          console.error("Failed to load session messages", e);
          navigate("/create", { replace: true });
      } finally {
          setIsLoading(false);
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

  // --- Session Management ---
  const handleNewChat = (shouldNavigate = true) => {
      setCurrentSessionId(null);
      setMessages([WELCOME_MESSAGE]);
      setInput("");
      if (shouldNavigate) {
          navigate("/create");
      }
  };

  const handleDeleteSession = async (sid: string) => {
      try {
          await api.gemini.deleteSession(sid);
          setSessions(prev => prev.filter(s => s.id !== sid));
          
          if (currentSessionId === sid) {
              handleNewChat(true);
          }
      } catch (e) {
          console.error("Failed to delete session", e);
      }
  };

  const handleSessionSelect = (sid: string) => {
      navigate(`/create/${sid}`);
  };

  // --- Handle Sending ---
  const handleSend = async (textOverride?: string | any, playlistOverride?: any) => {
    const isOverride = typeof textOverride === 'string';
    const textToSend = isOverride ? textOverride : input;
    if (!textToSend.trim()) return;

    // 1. Add User Message to UI
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      type: "text",
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!isOverride) {
      setInput("");
    }
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
            
            // Sync URL with the new session
            navigate(`/create/${newSession.id}`, { replace: true });
          } catch(e) {
              console.error("Failed to create session, proceeding without saving", e);
          }
      }

      // 2. Prepare History
      const history = getHistoryForBackend(newMessages);

      // Default the override payload to the newest message if the user simply types "Yes" via keyboard
      let finalPlaylistOverride = playlistOverride;
      if (!finalPlaylistOverride && messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.isAwaitingConfirmation && lastMsg.pendingPlaylist) {
               finalPlaylistOverride = lastMsg.pendingPlaylist;
          }
      }

      // 3. Call the API
      const data = await api.gemini.chat(userMsg.content, history, activeSessionId || undefined, finalPlaylistOverride);

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
        isAwaitingConfirmation: data.is_awaiting_confirmation,
        pendingPlaylist: data.pending_playlist,
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
    "Create a mix of my top genres and try to add some acoustic covers",
    "Make a 20-track playlist based on my top artists for a road trip",
    "Look at my recent playlists and suggest some new tracks like them",
    "Surprise me with a chill playlist using my favorite artists"
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
          {isAuthenticated && user && (
            <div className="flex items-center gap-2">
              <Button 
                  className="bg-zinc-800 text-white border border-white/10 hidden sm:flex font-semibold" 
                  onPress={() => handleNewChat()}
                  isDisabled={isLoading}
                  startContent={<Plus size={18} />}
              >
                  New Chat
              </Button>
              <Button 
                  isIconOnly
                  className="bg-zinc-800 text-white border border-white/10 sm:hidden" 
                  onPress={() => handleNewChat()}
                  isDisabled={isLoading}
              >
                  <Plus size={20} />
              </Button>
              <Button 
                  isIconOnly 
                  className="bg-[#1DB954] text-black" 
                  onPress={onOpen}
                  isDisabled={isLoading}
              >
                  <History size={20} />
              </Button>
            </div>
          )}
        </div>

        {/* Chat History */}
        <ScrollShadow className="flex-1 rounded-2xl bg-zinc-900/30 border border-white/5 backdrop-blur-sm p-4 md:p-6 mb-4 overflow-y-auto">
          <div className="flex flex-col gap-6 min-h-0">
            {messages.map((msg, index) => {
              const spotifyMatch = msg.content.match(/(?:View on Spotify:\s*)?(https:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]+)/i);
              const cleanText = spotifyMatch ? msg.content.replace(spotifyMatch[0], "").trim() : msg.content;
              const spotifyUrl = spotifyMatch ? spotifyMatch[1] : null;

              return (
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
                    className={`p-4 rounded-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words hyphens-auto ${
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
                        a: ({ node, href, children, ...props }) => {
                          const isInternal = href?.startsWith("/");

                          if (isInternal) {
                            return (
                              <Link to={href!} className="text-[#1DB954] hover:underline font-semibold" {...props}>
                                {children}
                              </Link>
                            );
                          }
                          return (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#1DB954] hover:underline font-semibold"
                              {...props} 
                            >
                              {children}
                            </a>
                          );
                        },
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
                      {cleanText}
                    </ReactMarkdown>
                    {spotifyUrl && (
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-2 mt-3 w-full">
                        <Button
                          className="bg-[#1DB954] text-black font-bold flex-1"
                          onPress={() => window.open(spotifyUrl, "_blank", "noopener,noreferrer")}
                          startContent={<Music size={18} />}
                        >
                          View on Spotify
                        </Button>
                        <Button
                          className="bg-zinc-700 text-white font-bold flex-1"
                          onPress={() => navigate("/playlists")}
                          startContent={<Disc3 size={18} />}
                        >
                          View My Playlists
                        </Button>
                      </div>
                    )}
                    {msg.isAwaitingConfirmation && index === messages.length - 1 && (
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-2 mt-3 w-full">
                        {msg.pendingPlaylist && (
                          <Button
                            size="lg"
                            className="bg-[#1DB954] text-black font-bold flex-1"
                            onPress={() => {
                              setReviewPlaylist(msg.pendingPlaylist);
                              onReviewOpen();
                            }}
                            isDisabled={isLoading}
                          >
                            Review
                          </Button>
                        )}
                        <Button
                          size="lg"
                          className="bg-zinc-700 text-white font-bold flex-1"
                          onPress={() => handleSend("No, cancel")}
                          isDisabled={isLoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                 
                </div>
              </div>
            );
            })}

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
        <div className="bg-black z-20 shrink-0 pb-2">
          <Textarea
            minRows={1}
            maxRows={6}
            classNames={{
              input:
                "text-base !text-white placeholder:text-zinc-500 !bg-transparent py-1.5",
              inputWrapper:
                "bg-zinc-900 border border-zinc-800 data-[hover=true]:bg-zinc-900 focus-within:!bg-zinc-900 focus-within:!border-purple-500/50 rounded-3xl min-h-[56px] py-1 pl-6 pr-2 shadow-lg",
              innerWrapper: "gap-3 items-end pb-1",
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

        {/* Review Modal */}
        <Modal isOpen={isReviewOpen} onOpenChange={onReviewOpenChange} scrollBehavior="inside" backdrop="blur" classNames={{base: "bg-zinc-900 border border-white/10 text-white", header: "border-b border-white/10", footer: "border-t border-white/10"}}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  {reviewPlaylist?.name}
                  <span className="text-xs font-normal text-zinc-400">{reviewPlaylist?.description}</span>
                </ModalHeader>
                <ModalBody>
                  <div className="flex flex-col gap-3 py-4">
                    {reviewPlaylist?.tracks_display?.map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-800/50 p-2 rounded-lg border border-white/5 hover:bg-zinc-800 hover:border-white/10 transition-colors group">
                        <a href={t.url || "#"} target={t.url ? "_blank" : undefined} rel={t.url ? "noopener noreferrer" : undefined} className="flex items-center gap-3 flex-1 min-w-0">
                          {t.image ? (
                            <img src={t.image} alt={t.name} className="w-12 h-12 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-zinc-700 flex items-center justify-center shrink-0">
                              <Music size={20} className="text-zinc-500" />
                            </div>
                          )}
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-semibold truncate hover:text-[#1DB954] transition-colors">{t.name}</span>
                            <span className="text-xs text-zinc-400 truncate">{t.artists}</span>
                          </div>
                        </a>
                        <Button 
                          isIconOnly 
                          size="sm" 
                          variant="light" 
                          className="text-zinc-500 hover:text-red-500 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onPress={() => handleRemoveTrack(i)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Close
                  </Button>
                  <Button className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold" onPress={() => {
                    onClose();
                    handleSend("No, cancel", reviewPlaylist);
                  }}>
                    Cancel Playlist
                  </Button>
                  <Button className="bg-[#1DB954] text-black font-bold" onPress={() => {
                    onClose();
                    handleSend("Yes, create it", reviewPlaylist);
                  }}>
                    Yes, Create It
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
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
