import { useState, useEffect } from "react";
import {
  Input,
  Button,
  Select,
  SelectItem,
  Card,
  CardBody,
  Image,
  Skeleton,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { Search, Music, Disc, User as UserIcon, Plus, CheckCircle, XCircle } from "lucide-react";
import { api, AuthError } from "../services/api";
import { useNavigate } from "react-router-dom";

// Types for search results
// Simplified types based on Spotify API
interface SearchResultItem {
  id: string;
  name: string;
  images?: { url: string }[]; // Artists, Albums, Playlists
  album?: { images: { url: string }[] }; // Tracks
  artists?: { name: string }[]; // Tracks, Albums
  owner?: { display_name: string }; // Playlists
  uri: string;
  external_urls: { spotify: string };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("track");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [playlists, setPlaylists] = useState<{id: string, name: string}[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();
  const {isOpen, onOpen, onOpenChange} = useDisclosure();
  const [selectedTrackUri, setSelectedTrackUri] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    // Fetch user profile and playlists
    Promise.all([
      api.spotify.getMe(),
      api.spotify.getPlaylists()
    ]).then(([userData, playlistData]) => {
        const userId = userData.user.id;
        const ownedPlaylists = playlistData.playlists.filter((p: any) => p.owner_id === userId);
        setPlaylists(ownedPlaylists);
        setIsLoggedIn(true);
    }).catch((err) => {
        if (err instanceof AuthError) {
            setIsLoggedIn(false);
        } else {
            // If it's another error, we might still be logged in, but failed to fetch.
            // For safety/UI clarity, if we can't get playlists, we can assume logged in state is uncertain or just treat as logged in but empty/error.
            // But usually this catch block means we failed. 
            // Let's rely on AuthError for explicit "not logged in".
            setIsLoggedIn(true); 
        }
    });
  }, []);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  const handleAddToPlaylist = async (playlistId: string, trackUri: string) => {
      try {
          await api.spotify.addTracksToPlaylist(playlistId, [trackUri]);
          setToast({ message: "Track added to playlist!", type: "success" });
      } catch (err) {
          console.error(err);
          setToast({ message: "Failed to add track.", type: "error" });
      }
  };

  // Debounce search? Or just search on Enter/Button.
  // Converting to search-on-enter for simplicity and to avoid rate limits during typing
  const handleSearch = async (overrideType?: string) => {
    const searchType = overrideType || type;
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const data = await api.spotify.search(query, searchType);
      
      // Parse results based on type. keys are 'tracks', 'artists', 'albums', 'playlists' + 'items'
      let items: SearchResultItem[] = [];
      const pluralType = searchType + "s"; // track -> tracks, artist -> artists
      
      if (data && data[pluralType] && data[pluralType].items) {
          items = data[pluralType].items;
      }
      
      setResults(items);
    } catch (err: any) {
        if (err instanceof AuthError) {
             setShowLoginPrompt(true);
             setResults([]); 
        } else {
             setError(err.message || "Search failed");
        }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Helper to get image URL safely
  const getImageUrl = (item: SearchResultItem) => {
      // Logic varies by type
      if (item.images && item.images.length > 0) return item.images[0].url;
      if (item.album && item.album.images && item.album.images.length > 0) return item.album.images[0].url;
      return "/vite.svg"; // Fallback
  };

  // Helper to get subtitle (Artist name, Owner, etc)
  const getSubtitle = (item: SearchResultItem) => {
      if (item.artists) return item.artists.map(a => a.name).join(", ");
      if (item.owner) return `By ${item.owner.display_name}`;
      return "";
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto relative">
      {/* Toast Notification */}
      {toast && (
          <div className={`fixed bottom-8 right-8 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === "success" ? "bg-zinc-900 border-green-500/50 text-white" : "bg-red-900/90 border-red-500/50 text-white"} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
              {toast.type === "success" ? <CheckCircle className="text-green-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
              <span className="font-medium">{toast.message}</span>
          </div>
      )}

      <div className="flex flex-col gap-8">
        {/* Header & Search Bar */}
        <div className="flex flex-col gap-4">
             <h1 className="text-4xl font-bold flex items-center gap-3">
                <Search size={32} /> Search Spotify
             </h1>
             
             <div className="flex flex-col md:flex-row gap-4">
                <Input 
                    placeholder="What do you want to listen to?" 
                    value={query}
                    onValueChange={(val) => {
                        setQuery(val);
                        setHasSearched(false);
                        setShowLoginPrompt(false);
                    }}
                    onKeyDown={handleKeyDown}
                    size="lg"
                    startContent={<Search className="text-zinc-300" />}
                    classNames={{
                        inputWrapper: "bg-zinc-900 border border-zinc-700 data-[hover=true]:border-zinc-500 data-[hover=true]:bg-zinc-900 group-data-[focus=true]:border-green-500 group-data-[focus=true]:bg-zinc-900",
                        input: "!text-white placeholder:!text-zinc-400"
                    }}
                    className="flex-grow"
                />
                
                <Select
                    selectedKeys={[type]}
                    onChange={(e) => {
                        const newType = e.target.value;
                        setType(newType);
                        setResults([]);
                        if(query) handleSearch(newType);
                    }}
                    disallowEmptySelection
                    className="w-full md:w-48"
                    size="lg"
                    classNames={{
                        trigger: "bg-zinc-900 border border-zinc-700 data-[hover=true]:bg-zinc-800 text-white",
                        value: "!text-white",
                        popoverContent: "bg-zinc-900 border border-zinc-800",
						selectorIcon: "text-white",
                    }}
					listboxProps={{
						itemClasses: {
							base: "text-zinc-300 data-[hover=true]:bg-zinc-700 data-[hover=true]:!text-white data-[selectable=true]:focus:bg-zinc-700",
						},
					}}
                >
                    <SelectItem key="track" startContent={<Music size={18} />}>Tracks</SelectItem>
                    <SelectItem key="artist" startContent={<UserIcon size={18} />}>Artists</SelectItem>
                    <SelectItem key="album" startContent={<Disc size={18} />}>Albums</SelectItem>
                </Select>
                
                <Button 
                    size="lg" 
                    className="bg-green-500 text-black font-bold w-full md:w-auto"
                    onPress={() => handleSearch()}
                    isLoading={loading}
                >
                    Search
                </Button>
             </div>
        </div>
        
        {/* Results */}
        {error && <div className="text-red-500 bg-red-500/10 p-4 rounded-lg">{error}</div>}
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {loading ? (
                Array(10).fill(0).map((_, i) => (
                    <Card key={i} className="bg-zinc-900/50 border border-zinc-800 p-4 space-y-4" radius="lg">
                         <Skeleton className="rounded-lg w-full aspect-square bg-zinc-800" />
                         <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4 rounded bg-zinc-800" />
                            <Skeleton className="h-3 w-1/2 rounded bg-zinc-800" />
                         </div>
                    </Card>
                ))
            ) : results.length > 0 ? (
                results.map((item) => (
                    <Card 
                        key={item.id} 
                        isPressable 
                        onPress={() => window.open(item.external_urls.spotify, "_blank")}
                        className="bg-zinc-900/40 border border-white/5 hover:bg-zinc-800 transition-all p-4"
                    >
                        <CardBody className="overflow-visible p-0 flex flex-col gap-3">
                             <Image 
                                src={getImageUrl(item)}
                                alt={item.name}
                                className="w-full aspect-square object-cover rounded-lg"
                                radius="lg"
                                width="100%"
                             />
                             <div className="flex flex-col gap-1 text-left relative group">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-white text-md line-clamp-1 pr-6" title={item.name}>{item.name}</h3>
                                    {item.uri.includes(":track:") && (
                                        <div className="absolute right-0 top-0" onClick={(e) => e.stopPropagation()}>
                                            <Tooltip content="Add to playlist" closeDelay={0}>
                                                <Button 
                                                    isIconOnly 
                                                    size="sm" 
                                                    variant="light" 
                                                    className="text-white hover:text-green-500 min-w-0 w-6 h-6 data-[hover=true]:bg-transparent"
                                                    onPress={() => {
                                                        setSelectedTrackUri(item.uri);
                                                        onOpen();
                                                    }}
                                                >
                                                    <Plus size={16} />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-zinc-300 line-clamp-1">{getSubtitle(item)}</p>
                             </div>
                        </CardBody>
                    </Card>
                ))
            ) : showLoginPrompt ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <p className="text-zinc-300 text-lg">Please log in to search Spotify</p>
                    <Button 
                        color="success" 
                        variant="flat"
                        onPress={() => navigate("/login")}
                        className="font-bold"
                    >
                        Log in with Spotify
                    </Button>
                </div>
            ) : results.length === 0 && hasSearched && !loading && !error && (
                 <div className="col-span-full text-center py-20 text-zinc-300">
                    No results found for "{query}".
                 </div>
            )}
        </div>
      </div>
      
      {/* Playlist Modal */}
      <Modal 
        isOpen={isOpen} 
        onOpenChange={onOpenChange}
        className="dark text-white bg-zinc-900 border border-zinc-800"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Add to Playlist</ModalHeader>
              <ModalBody>
                {!isLoggedIn ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
                        <p className="text-zinc-300">You need to be logged in to add tracks to a playlist.</p>
                        <Button 
                            color="success" 
                            variant="flat"
                            onPress={() => {
                                onClose();
                                navigate("/login");
                            }}
                            className="font-bold"
                        >
                            Log in with Spotify
                        </Button>
                    </div>
                ) : playlists.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {playlists.map(playlist => (
                            <Button
                                key={playlist.id}
                                className="justify-start bg-zinc-800 hover:bg-zinc-700 text-white"
                                onPress={() => {
                                    if(selectedTrackUri) {
                                        handleAddToPlaylist(playlist.id, selectedTrackUri);
                                        onClose();
                                    }
                                }}
                            >
                                <Music size={16} className="mr-2" />
                                {playlist.name}
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="text-zinc-400 text-center py-4">
                        No playlists found. Create one first!
                    </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
