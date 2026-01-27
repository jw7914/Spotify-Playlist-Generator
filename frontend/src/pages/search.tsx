import { useState } from "react";
import {
  Input,
  Button,
  Select,
  SelectItem,
  Card,
  CardBody,
  Image,
  Skeleton,
} from "@heroui/react";
import { Search, Music, Disc, User as UserIcon, ListMusic } from "lucide-react";
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
  const navigate = useNavigate();

  // Debounce search? Or just search on Enter/Button.
  // Converting to search-on-enter for simplicity and to avoid rate limits during typing
  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const data = await api.spotify.search(query, type);
      
      // Parse results based on type. keys are 'tracks', 'artists', 'albums', 'playlists' + 'items'
      let items: SearchResultItem[] = [];
      const pluralType = type + "s"; // track -> tracks, artist -> artists
      
      if (data && data[pluralType] && data[pluralType].items) {
          items = data[pluralType].items;
      }
      
      setResults(items);
    } catch (err: any) {
        if (err instanceof AuthError) {
             navigate("/login", { replace: true });
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
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto">
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
                    onValueChange={setQuery}
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
                    onChange={(e) => setType(e.target.value)}
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
							base: "text-zinc-300 data-[hover=true]:bg-zinc-800 data-[hover=true]:text-white data-[selectable=true]:focus:bg-zinc-800",
						},
					}}
                >
                    <SelectItem key="track" startContent={<Music size={18} />}>Tracks</SelectItem>
                    <SelectItem key="artist" startContent={<UserIcon size={18} />}>Artists</SelectItem>
                    <SelectItem key="album" startContent={<Disc size={18} />}>Albums</SelectItem>
                    <SelectItem key="playlist" startContent={<ListMusic size={18} />}>Playlists</SelectItem>
                </Select>
                
                <Button 
                    size="lg" 
                    className="bg-green-500 text-black font-bold w-full md:w-auto"
                    onPress={handleSearch}
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
                             <div className="flex flex-col gap-1 text-left">
                                <h3 className="font-bold text-white text-md line-clamp-1" title={item.name}>{item.name}</h3>
                                <p className="text-xs text-zinc-300 line-clamp-1">{getSubtitle(item)}</p>
                             </div>
                        </CardBody>
                    </Card>
                ))
            ) : query && !loading && !error && (
                 <div className="col-span-full text-center py-20 text-zinc-300">
                    No results found for "{query}".
                 </div>
            )}
        </div>
      </div>
    </div>
  );
}
