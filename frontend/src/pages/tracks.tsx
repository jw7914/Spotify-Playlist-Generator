import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Image,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Skeleton,
  User,
} from "@heroui/react";
import {
  ArrowLeft,
  Clock,
  MoreHorizontal,
  Play,
  ExternalLink,
} from "lucide-react";

// --- Interfaces based on Spotify API Structure ---

interface Artist {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

interface Album {
  id: string;
  name: string;
  images: { url: string }[];
}

interface Track {
  id: string;
  name: string;
  album: Album;
  artists: Artist[];
  duration_ms: number;
  external_urls: { spotify: string };
  uri: string;
}

interface PlaylistItem {
  added_at: string;
  track: Track;
}

interface PlaylistDetails {
  id: string;
  name: string;
  description: string;
  images: { url: string }[] | null;
  owner: { display_name: string };
  followers: { total: number };
  tracks: {
    items: PlaylistItem[];
    total: number;
  };
  external_urls: { spotify: string };
}

// --- Helper Functions ---

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function PlaylistDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    // Assumes your backend proxies GET /playlists/{id}
    // Note: The endpoint in your screenshot (/tracks) only returns the list.
    // Usually, you want the parent endpoint (/playlists/{id}) to get the cover art + tracks.
    fetch(`/api/playlists/${id}`)
      .then(async (res) => {
        if (res.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (!res.ok) throw new Error("Failed to load playlist");
        return res.json();
      })
      .then((data) => {
        if (data) setPlaylist(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onPress={() => navigate(-1)} variant="flat">
          Go Back
        </Button>
      </div>
    );
  }

  // --- Loading Skeleton ---
  if (loading || !playlist) {
    return (
      <div className="min-h-screen bg-black text-white p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex gap-6 items-end">
          <Skeleton className="rounded-lg w-52 h-52 bg-zinc-800" />
          <div className="w-full space-y-3">
            <Skeleton className="h-4 w-20 rounded-lg bg-zinc-800" />
            <Skeleton className="h-12 w-1/2 rounded-lg bg-zinc-800" />
            <Skeleton className="h-4 w-1/3 rounded-lg bg-zinc-800" />
          </div>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-foreground pb-20">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-50 bg-black/50 backdrop-blur-md px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-black/50 hover:bg-zinc-800 transition"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-6">
        {/* --- Playlist Header --- */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-8 mb-8 pb-8 border-b border-zinc-800">
          <div className="shadow-2xl shadow-black/50 rounded-lg overflow-hidden shrink-0">
            {playlist.images?.[0]?.url ? (
              <Image
                src={playlist.images[0].url}
                alt={playlist.name}
                width={230}
                height={230}
                className="object-cover"
                radius="none"
              />
            ) : (
              <div className="w-[230px] h-[230px] bg-zinc-800 flex items-center justify-center">
                <span className="text-4xl">🎵</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full">
            <span className="uppercase text-xs font-bold tracking-widest text-white">
              Playlist
            </span>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-2">
              {playlist.name}
            </h1>
            <p className="text-zinc-400 text-sm max-w-2xl line-clamp-2">
              {playlist.description || "No description provided."}
            </p>

            <div className="flex items-center gap-2 mt-2 text-sm text-white font-medium">
              {/* Simulated Owner Avatar if available, or just name */}
              <span>{playlist.owner.display_name}</span>
              <span className="text-zinc-400">•</span>
              <span>{playlist.followers.total.toLocaleString()} likes</span>
              <span className="text-zinc-400">•</span>
              <span>{playlist.tracks.total} songs</span>
            </div>
          </div>
        </div>

        {/* --- Action Bar --- */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            isIconOnly
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 text-black"
            onPress={() =>
              window.open(playlist.external_urls.spotify, "_blank")
            }
          >
            <Play fill="currentColor" size={24} className="ml-1" />
          </Button>

          <Button
            variant="bordered"
            className="border-zinc-600 hover:border-white text-white font-bold"
            onPress={() =>
              window.open(playlist.external_urls.spotify, "_blank")
            }
            endContent={<ExternalLink size={16} />}
          >
            Open in Spotify
          </Button>

          <Button
            isIconOnly
            variant="light"
            className="text-zinc-400 hover:text-white"
          >
            <MoreHorizontal size={32} />
          </Button>
        </div>

        {/* --- Tracks Table --- */}
        <Table
          aria-label="Playlist Tracks"
          removeWrapper
          classNames={{
            th: "bg-transparent text-zinc-400 border-b border-zinc-800 hover:text-white transition-colors",
            td: "py-3 group-hover:bg-white/5 transition-colors cursor-default",
            tr: "group hover:bg-white/5 rounded-lg transition-colors border-b border-transparent hover:border-transparent",
            base: "overflow-visible",
          }}
        >
          <TableHeader>
            <TableColumn className="w-10">#</TableColumn>
            <TableColumn>Title</TableColumn>
            <TableColumn className="hidden md:table-cell">Album</TableColumn>
            <TableColumn className="hidden lg:table-cell">
              Date Added
            </TableColumn>
            <TableColumn className="w-20">
              <Clock size={16} />
            </TableColumn>
          </TableHeader>
          <TableBody emptyContent="No tracks found in this playlist.">
            {playlist.tracks.items
              // 1. Filter out items where 'track' is null or undefined
              .filter((item) => item.track)
              // 2. Now map only the valid items
              .map((item, index) => (
                <TableRow
                  key={`${item.track.id}-${index}`}
                  className="hover:bg-white/10"
                >
                  <TableCell className="text-zinc-400 font-medium w-10">
                    {index + 1}
                  </TableCell>

                  <TableCell>
                    <User
                      name={item.track.name}
                      description={
                        <div className="text-zinc-400 group-hover:text-white transition-colors">
                          {item.track.artists.map((a) => a.name).join(", ")}
                        </div>
                      }
                      avatarProps={{
                        src: item.track.album.images?.[0]?.url,
                        radius: "sm",
                        className: "w-10 h-10 mr-2",
                      }}
                      classNames={{
                        name: "text-white font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] md:max-w-xs",
                        description: "text-xs",
                      }}
                    />
                  </TableCell>

                  <TableCell className="hidden md:table-cell text-zinc-400 hover:text-white transition-colors text-sm">
                    {item.track.album.name}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-zinc-400 text-sm whitespace-nowrap">
                    {formatDate(item.added_at)}
                  </TableCell>

                  <TableCell className="text-zinc-400 text-sm font-variant-numeric tabular-nums">
                    {formatDuration(item.track.duration_ms)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </main>
    </div>
  );
}
