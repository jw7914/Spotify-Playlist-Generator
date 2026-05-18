import { useState, useEffect } from "react";
import {
  Input,
  Button,
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
  Switch,
  Textarea,
} from "@heroui/react";
import {
  Search,
  Music,
  Plus,
  CheckCircle,
  XCircle,
  Heart,
  UserPlus,
  ListPlus,
  ArrowUpRight,
} from "lucide-react";
import { api, AuthError } from "../services/api";
import { useNavigate, useSearchParams } from "react-router-dom";

const FALLBACK_GENRE_SEEDS = [
  "pop",
  "hip-hop",
  "rock",
  "indie",
  "house",
  "techno",
  "edm",
  "jazz",
  "country",
  "r-n-b",
  "soul",
  "blues",
];

// Types for search results
// Simplified types based on Spotify API
interface SearchResultItem {
  id: string;
  name: string;
  images?: { url: string }[]; // Artists, Albums, Playlists
  album?: { images?: { url: string }[]; image?: string; name?: string }; // Tracks
  artists?: { name: string }[]; // Tracks, Albums
  owner?: { display_name: string }; // Playlists
  uri: string;
  external_urls: { spotify: string };
}

export default function SearchPage() {
  const [searchView, setSearchView] = useState<"search" | "discover">(
    "discover",
  );
  const [query, setQuery] = useState("");
  const [type, setType] = useState("track");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<SearchResultItem[]>(
    [],
  );
  const [genreSeeds, setGenreSeeds] = useState<string[]>([]);
  const [genreSeedsLoading, setGenreSeedsLoading] = useState(true);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [newReleasesLoading, setNewReleasesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedTrackUri, setSelectedTrackUri] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Modal State for "Create Playlist"
  const [modalView, setModalView] = useState<"list" | "create">("list");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [creating, setCreating] = useState(false);

  const isDiscoverView = searchView === "discover";
  const activeResults = isDiscoverView ? discoveryResults : results;
  const activeResultType = isDiscoverView ? "track" : type;
  const sectionTitle = isDiscoverView
    ? isLoggedIn
      ? "Suggested for you"
      : "Popular on Spotify"
    : "Search results";
  const sectionSubtitle = isDiscoverView
    ? isLoggedIn
      ? "Recommendations based on your Spotify taste"
      : "A few tracks to start exploring"
    : hasSearched
      ? `Showing ${results.length} ${type}${results.length === 1 ? "" : "s"}`
      : "Run a search or use a genre seed to start exploring.";

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setModalView("list");
      setNewPlaylistName("");
      setNewPlaylistDesc("");
      setIsPublic(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // Fetch user profile and playlists
    Promise.all([api.spotify.getMe(), api.spotify.getPlaylists()])
      .then(([userData, playlistData]) => {
        const userId = userData.user.id;
        const ownedPlaylists = playlistData.playlists.filter(
          (p: any) => p.owner_id === userId,
        );
        setPlaylists(ownedPlaylists);
        setIsLoggedIn(true);
      })
      .catch((err) => {
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
    const loadDefaultResults = async () => {
      setDiscoverLoading(true);
      try {
        const recommendationData = await api.spotify.getRecommendations(12);
        setDiscoveryResults(recommendationData.tracks || []);
        setIsLoggedIn(true);
      } catch (err) {
        try {
          const fallback = await api.spotify.search("top hits", "track", 12);
          setDiscoveryResults(fallback?.tracks?.items || []);
        } catch (fallbackErr: any) {
          if (!(fallbackErr instanceof AuthError)) {
            setError(fallbackErr.message || "Failed to load discovery tracks");
          }
        }
      } finally {
        setDiscoverLoading(false);
      }
    };

    loadDefaultResults();
  }, []);

  useEffect(() => {
    api.spotify
      .getAvailableGenreSeeds()
      .then((data) => {
        const seeds = (data.genres || []).slice(0, 16);
        setGenreSeeds(seeds.length > 0 ? seeds : FALLBACK_GENRE_SEEDS);
      })
      .catch(() => {
        setGenreSeeds(FALLBACK_GENRE_SEEDS);
      })
      .finally(() => setGenreSeedsLoading(false));

    api.spotify
      .getNewReleases("US", 8)
      .then((data) => setNewReleases(data.items || []))
      .catch((err) => console.error("Failed to load new releases", err))
      .finally(() => setNewReleasesLoading(false));
  }, []);

  useEffect(() => {
    const initialQuery = searchParams.get("q");
    if (initialQuery) {
      setQuery(initialQuery);
      setHasSearched(false);
      handleSearch("track", initialQuery);
    }
  }, [searchParams]);

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

  const handleSaveTrack = async (trackId: string) => {
    try {
      await api.spotify.saveTracks([trackId]);
      setToast({ message: "Saved to Liked Songs.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to save track.", type: "error" });
    }
  };

  const handleSaveAlbum = async (albumId: string) => {
    try {
      await api.spotify.saveAlbums([albumId]);
      setToast({ message: "Album saved to your library.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to save album.", type: "error" });
    }
  };

  const handleFollowArtist = async (artistId: string) => {
    try {
      await api.spotify.followArtists([artistId]);
      setToast({ message: "Artist followed.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to follow artist.", type: "error" });
    }
  };

  const handleQueueTrack = async (trackUri: string) => {
    try {
      await api.spotify.addToQueue(trackUri);
      setToast({ message: "Added to queue.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to add to queue.", type: "error" });
    }
  };

  const handleCreatePlaylistAndAddTrack = async (onClose: () => void) => {
    if (!newPlaylistName.trim() || !selectedTrackUri) return;

    setCreating(true);
    try {
      // 1. Create Playlist
      const newPlaylist = await api.spotify.createPlaylist(
        newPlaylistName,
        newPlaylistDesc,
        isPublic,
      );

      // 2. Add Track
      await api.spotify.addTracksToPlaylist(newPlaylist.id, [selectedTrackUri]);

      // 3. Refresh Playlists (optional, but good for local state if we re-open)
      // We can just append closer to UI state if needed, but fetching is cleaner
      api.spotify.getPlaylists().then((data) => {
        const userId = data.playlists[0]?.owner.id; // Rough guess, or use stored user
        setPlaylists(
          data.playlists.filter(
            (p: any) =>
              p.owner.id === userId || p.owner.id === p.owner.display_name,
          ),
        );
      });

      setToast({
        message: "Playlist created and track added!",
        type: "success",
      });
      onClose();
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to create playlist.", type: "error" });
    } finally {
      setCreating(false);
    }
  };

  // Debounce search? Or just search on Enter/Button.
  // Converting to search-on-enter for simplicity and to avoid rate limits during typing
  const handleSearch = async (
    overrideType?: string,
    overrideQuery?: string,
  ) => {
    const searchType = overrideType || type;
    const searchQuery = overrideQuery ?? query;
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);
    setSearchView("search");

    try {
      const data = await api.spotify.search(searchQuery, searchType);

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
    if (item.album?.image) return item.album.image;
    if (item.album && item.album.images && item.album.images.length > 0)
      return item.album.images[0].url;
    return "/vite.svg"; // Fallback
  };

  // Helper to get subtitle (Artist name, Owner, etc)
  const getSubtitle = (item: SearchResultItem) => {
    if (item.artists) return item.artists.map((a) => a.name).join(", ");
    if (item.owner) return `By ${item.owner.display_name}`;
    return "";
  };

  const renderResultsContent = () => {
    if (loading || (isDiscoverView && discoverLoading)) {
      return Array(10)
        .fill(0)
        .map((_, i) => (
          <Card
            key={i}
            className="bg-zinc-900/50 border border-zinc-800 p-4 space-y-4"
            radius="lg"
          >
            <Skeleton className="rounded-lg w-full aspect-square bg-zinc-800" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4 rounded bg-zinc-800" />
              <Skeleton className="h-3 w-1/2 rounded bg-zinc-800" />
            </div>
          </Card>
        ));
    }

    if (activeResults.length > 0) {
      return activeResults.map((item) => (
        <Card
          key={item.id}
          isPressable
          onPress={() => window.open(item.external_urls.spotify, "_blank")}
          className={`transition-all p-4 ${
            activeResultType === "artist"
              ? "bg-transparent border-none hover:bg-zinc-900/50 shadow-none"
              : "bg-zinc-900/40 border border-white/5 hover:bg-zinc-800 hover:border-white/10"
          }`}
        >
          <CardBody
            className={`overflow-visible p-0 flex flex-col gap-3 ${activeResultType === "artist" ? "items-center text-center" : ""}`}
          >
            <Image
              src={getImageUrl(item)}
              alt={item.name}
              className={`object-cover ${
                activeResultType === "artist"
                  ? "w-40 h-40 rounded-full"
                  : "w-full aspect-square rounded-lg"
              }`}
              radius={activeResultType === "artist" ? "full" : "lg"}
              width={activeResultType === "artist" ? "160px" : "100%"}
            />
            <div
              className={`flex flex-col gap-1 group min-w-0 ${activeResultType === "artist" ? "items-center w-full" : "text-left"}`}
            >
              <div
                className={`flex min-w-0 ${activeResultType === "artist" ? "justify-center w-full" : "justify-between items-start gap-2"}`}
              >
                <h3
                  className="min-w-0 flex-1 font-bold text-white text-md truncate"
                  title={item.name}
                >
                  {item.name}
                </h3>
                {item.uri.includes(":track:") &&
                  activeResultType !== "artist" && (
                    <div
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <Tooltip content="Add to queue" closeDelay={0}>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="text-white hover:text-green-500 min-w-0 w-6 h-6 data-[hover=true]:bg-transparent"
                            onPress={() => handleQueueTrack(item.uri)}
                          >
                            <ListPlus size={16} />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Save track" closeDelay={0}>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="text-white hover:text-green-500 min-w-0 w-6 h-6 data-[hover=true]:bg-transparent"
                            onPress={() => handleSaveTrack(item.id)}
                          >
                            <Heart size={15} />
                          </Button>
                        </Tooltip>
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
                    </div>
                  )}
              </div>
              <p className="text-xs text-zinc-300 line-clamp-1">
                {getSubtitle(item)}
              </p>
              {activeResultType === "artist" && (
                <Button
                  size="sm"
                  variant="bordered"
                  className="mt-2 border-white/10 bg-zinc-950 text-zinc-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFollowArtist(item.id);
                  }}
                  startContent={<UserPlus size={14} />}
                >
                  Follow
                </Button>
              )}
              {activeResultType === "album" && (
                <Button
                  size="sm"
                  variant="bordered"
                  className="mt-2 border-white/10 bg-zinc-950 text-zinc-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveAlbum(item.id);
                  }}
                  startContent={<Heart size={14} />}
                >
                  Save Album
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      ));
    }

    if (showLoginPrompt) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-zinc-300 text-lg">
            Please log in to search Spotify
          </p>
          <Button
            color="success"
            variant="flat"
            onPress={() => navigate("/login")}
            className="font-bold"
          >
            Log in with Spotify
          </Button>
        </div>
      );
    }

    if (
      !isDiscoverView &&
      activeResults.length === 0 &&
      hasSearched &&
      !loading &&
      !error
    ) {
      return (
        <div className="col-span-full text-center py-20 text-zinc-300">
          No results found for "{query}".
        </div>
      );
    }

    if (
      isDiscoverView &&
      activeResults.length === 0 &&
      !discoverLoading &&
      !error
    ) {
      return (
        <div className="col-span-full text-center py-20 text-zinc-300">
          No discovery tracks available right now.
        </div>
      );
    }

    if (
      !isDiscoverView &&
      activeResults.length === 0 &&
      !hasSearched &&
      !loading &&
      !error
    ) {
      return (
        <div className="col-span-full text-center py-20 text-zinc-300">
          Search for a track, artist, or album to see results.
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-8 right-8 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === "success" ? "bg-zinc-900 border-green-500/50 text-white" : "bg-red-900/90 border-red-500/50 text-white"} animate-in fade-in slide-in-from-bottom-4 duration-300`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="text-green-500" size={24} />
          ) : (
            <XCircle className="text-red-500" size={24} />
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Header & Search Bar */}
        <div className="rounded-[28px] border border-white/5 bg-zinc-900/40 backdrop-blur-sm p-5 md:p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
              <Search size={14} /> Explore Spotify
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              {isDiscoverView
                ? "Discover something worth playing."
                : "Search tracks, artists, and albums."}
            </h1>
            <p className="max-w-2xl text-zinc-400">
              {isDiscoverView
                ? "Browse recent albums and personalized Spotify recommendations."
                : "Find something specific or use genre seeds as a faster starting point."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "discover", label: "Discover" },
              { key: "search", label: "Search" },
            ].map((view) => (
              <Button
                key={view.key}
                size="sm"
                variant={searchView === view.key ? "solid" : "bordered"}
                className={
                  searchView === view.key
                    ? "bg-white text-black font-semibold"
                    : "border-white/10 bg-zinc-950 text-zinc-300"
                }
                onPress={() => setSearchView(view.key as "search" | "discover")}
              >
                {view.label}
              </Button>
            ))}
          </div>

          {searchView === "search" && (
            <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
              <div className="mb-4 flex flex-col gap-4 md:flex-row">
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
                    inputWrapper:
                      "bg-zinc-900 border border-zinc-700 data-[hover=true]:border-zinc-500 data-[hover=true]:bg-zinc-900 group-data-[focus=true]:border-green-500 group-data-[focus=true]:bg-zinc-900",
                    input: "!text-white placeholder:!text-zinc-400",
                  }}
                  className="flex-grow"
                />

                <Button
                  size="lg"
                  className="bg-green-500 text-black font-bold w-full md:w-auto"
                  onPress={() => handleSearch()}
                  isLoading={loading}
                >
                  Search
                </Button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { key: "track", label: "Tracks" },
                  { key: "artist", label: "Artists" },
                  { key: "album", label: "Albums" },
                ].map((option) => (
                  <Button
                    key={option.key}
                    size="sm"
                    variant={type === option.key ? "solid" : "bordered"}
                    className={
                      type === option.key
                        ? "bg-green-500 text-black font-semibold"
                        : "border-white/10 bg-zinc-950 text-zinc-300"
                    }
                    onPress={() => {
                      setType(option.key);
                      setResults([]);
                      if (query) handleSearch(option.key);
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">
                    Genre Seeds
                  </p>
                  <p className="text-sm text-zinc-400">
                    Use Spotify recommendation genres as quick search prompts.
                  </p>
                </div>
                <div className="rounded-full border border-green-500/15 bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-green-300">
                  Seeds
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {genreSeedsLoading ? (
                  [...Array(8)].map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-10 w-24 rounded-full bg-zinc-800"
                    />
                  ))
                ) : genreSeeds.length > 0 ? (
                  genreSeeds.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => {
                        setQuery(genre);
                        handleSearch("track", genre);
                      }}
                      className="group inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-2 text-sm text-zinc-200 transition-all hover:border-green-500/30 hover:bg-green-500/10 hover:text-white"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400/80 transition-transform group-hover:scale-125" />
                      <span className="capitalize">{genre}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    No genre seeds available right now.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {error && (
          <div className="text-red-500 bg-red-500/10 p-4 rounded-lg">
            {error}
          </div>
        )}

        {searchView === "discover" && (
          <div className="rounded-[28px] border border-white/5 bg-zinc-900/30 backdrop-blur-sm p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-1">
                <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-300">
                  New
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  Browse what’s fresh, then keep listening.
                </h2>
                <p className="max-w-2xl text-sm text-zinc-400">
                  Explore recent albums here, then scroll into your suggested
                  recommendations below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-3xl border border-white/6 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-4 md:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      Recent Albums
                    </p>
                    <p className="text-sm text-zinc-400">
                      Jump into a fresh release and turn it into a search.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {newReleasesLoading ? (
                    [...Array(4)].map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-28 w-full rounded-2xl bg-zinc-800"
                      />
                    ))
                  ) : newReleases.length > 0 ? (
                    newReleases.map((album) => (
                      <div
                        key={album.id}
                        className="group rounded-2xl border border-white/6 bg-white/[0.03] p-3 transition-all hover:border-white/12 hover:bg-white/[0.05]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(album.name);
                            handleSearch("album", album.name);
                          }}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <img
                            src={album.images?.[0]?.url}
                            alt={album.name}
                            className="h-16 w-16 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {album.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                              {album.artists
                                ?.map((a: any) => a.name)
                                .join(", ")}
                            </p>
                            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600 transition-colors group-hover:text-zinc-400">
                              Search this album
                            </p>
                          </div>
                        </button>
                        {album.external_urls?.spotify && (
                          <a
                            href={album.external_urls.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-white"
                          >
                            Open in Spotify
                            <ArrowUpRight size={12} />
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-sm text-zinc-500">
                      No recent albums available right now.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {sectionTitle}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">{sectionSubtitle}</p>
          </div>
          {isDiscoverView && discoveryResults.length > 0 && (
            <Button
              size="sm"
              variant="bordered"
              className="border-white/10 bg-zinc-900 text-zinc-300"
              onPress={() => {
                setQuery("top hits");
                setType("track");
                handleSearch("track");
              }}
            >
              Search top hits
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {renderResultsContent()}
        </div>
      </div>

      {/* Playlist Modal */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        className="dark text-white bg-zinc-900 border border-zinc-800"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {modalView === "list"
                  ? "Add to Playlist"
                  : "Create New Playlist"}
              </ModalHeader>
              <ModalBody>
                {modalView === "list" ? (
                  !isLoggedIn ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
                      <p className="text-zinc-300">
                        You need to be logged in to add tracks to a playlist.
                      </p>
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
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button
                        className="justify-start bg-green-500/10 text-green-500 hover:bg-green-500/20 font-bold mb-2 shrink-0"
                        onPress={() => setModalView("create")}
                      >
                        <Plus size={16} className="mr-2" />
                        Create New Playlist
                      </Button>

                      {playlists.length > 0 ? (
                        playlists.map((playlist) => (
                          <Button
                            key={playlist.id}
                            className="justify-start bg-zinc-800 hover:bg-zinc-700 text-white shrink-0"
                            onPress={() => {
                              if (selectedTrackUri) {
                                handleAddToPlaylist(
                                  playlist.id,
                                  selectedTrackUri,
                                );
                                onClose();
                              }
                            }}
                          >
                            <Music size={16} className="mr-2" />
                            {playlist.name}
                          </Button>
                        ))
                      ) : (
                        <div className="text-zinc-400 text-center py-4">
                          No playlists found.
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  // Create View
                  <div className="flex flex-col gap-4 py-2">
                    <Input
                      autoFocus
                      label="Name"
                      placeholder="My Awesome Playlist"
                      variant="bordered"
                      value={newPlaylistName}
                      onValueChange={setNewPlaylistName}
                      classNames={{
                        inputWrapper:
                          "border-white/20 data-[hover=true]:border-white/40 group-data-[focus=true]:border-green-500",
                      }}
                    />
                    <Textarea
                      label="Description"
                      placeholder="Optional description..."
                      variant="bordered"
                      value={newPlaylistDesc}
                      onValueChange={setNewPlaylistDesc}
                      classNames={{
                        inputWrapper:
                          "border-white/20 data-[hover=true]:border-white/40 group-data-[focus=true]:border-green-500",
                      }}
                    />

                    <div className="flex justify-between items-center px-1">
                      <span className="text-sm text-zinc-400">
                        Public Playlist
                      </span>
                      <Switch
                        isSelected={isPublic}
                        onValueChange={setIsPublic}
                        size="sm"
                        color="success"
                      />
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                {modalView === "create" ? (
                  <>
                    <Button
                      variant="light"
                      onPress={() => setModalView("list")}
                    >
                      Back
                    </Button>
                    <Button
                      color="success"
                      onPress={() => handleCreatePlaylistAndAddTrack(onClose)}
                      isLoading={creating}
                      isDisabled={!newPlaylistName.trim()}
                      className="font-bold text-black"
                    >
                      Create & Add
                    </Button>
                  </>
                ) : (
                  <Button color="danger" variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
