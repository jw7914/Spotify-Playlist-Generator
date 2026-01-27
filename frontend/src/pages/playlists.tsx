import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardFooter,
  Image,
  Button,
  Skeleton,
  Chip,
} from "@heroui/react";

import { ExternalLink, Music, Library } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  owner: string;
  tracks_total: number;
  images: { url: string }[] | null;
  external_url: string;
}

const DefaultPlaylistImage = () => (
  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
    <Music
      size={64}
      className="text-white opacity-50 scale-90 transition-transform duration-500 group-hover:scale-100"
    />
  </div>
);

import { api, AuthError } from "../services/api";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.spotify.getPlaylists()
      .then((data) => {
        if (!data) return;
        setPlaylists(data.playlists || []);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof AuthError) {
             navigate("/login", { replace: true });
        } else {
             setError(err.message || "Unknown error");
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const renderSkeletons = () =>
    Array(8)
      .fill(0)
      .map((_, i) => (
        <Card
          key={i}
          className="w-full space-y-5 p-4 bg-zinc-900/50 border border-zinc-800"
          radius="lg"
        >
          <Skeleton className="rounded-lg">
            <div className="h-40 rounded-lg bg-default-300" />
          </Skeleton>
          <div className="space-y-3">
            <Skeleton className="w-3/5 rounded-lg">
              <div className="h-3 w-3/5 rounded-lg bg-default-200" />
            </Skeleton>
            <Skeleton className="w-4/5 rounded-lg">
              <div className="h-3 w-4/5 rounded-lg bg-default-200" />
            </Skeleton>
          </div>
        </Card>
      ));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500">
          <Music size={48} />
        </div>
        <h2 className="text-xl font-bold">Unable to load library</h2>
        <p className="text-zinc-500">{error}</p>
        <Button color="primary" onPress={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-foreground">
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-green-500">
              <Library size={20} />
              <span className="uppercase tracking-widest text-xs font-bold">
                Library
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white">Your Playlists</h1>
            <p className="text-zinc-400 mt-2">
              Select a playlist to analyze or generate new content from.
            </p>
          </div>

          <div className="text-zinc-500 text-sm font-medium">
            {loading ? "Syncing..." : `${playlists.length} Playlists Found`}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {loading ? (
            renderSkeletons()
          ) : playlists.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-500">
              <Music size={64} className="mb-4 opacity-20" />
              <p>No playlists found on your Spotify account.</p>
            </div>
          ) : (
            playlists.map((playlist) => (
              <Card
                key={playlist.id}
                isPressable
                className="group w-full bg-zinc-900/40 border border-white/5 hover:bg-zinc-800 transition-all duration-300"
                shadow="sm"
                // UPDATED: Navigates to internal route instead of external URL
                onPress={() => navigate(`/playlists/${playlist.id}`)}
              >
                <CardBody className="p-4 pb-2 overflow-visible relative">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-lg mb-4">
                    {playlist.images && playlist.images.length > 0 ? (
                      <Image
                        alt={playlist.name}
                        src={playlist.images[0].url}
                        className="object-cover w-full h-full"
                        radius="none"
                        width="100%"
                        height="100%"
                        classNames={{
                          wrapper: "w-full h-full",
                          img: "w-full h-full scale-100 group-hover:scale-105 transition-transform duration-500",
                        }}
                      />
                    ) : (
                      <DefaultPlaylistImage />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 backdrop-blur-[1px]">
                      <ExternalLink
                        size={48}
                        className="text-white drop-shadow-lg scale-90 group-hover:scale-100 transition-transform duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 items-start">
                    <h3
                      className="font-bold text-white text-md line-clamp-1 w-full"
                      title={playlist.name}
                    >
                      {playlist.name}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-1">
                      By {playlist.owner}
                    </p>
                  </div>
                </CardBody>

                <CardFooter className="px-4 pb-4 pt-0 flex justify-between items-center text-small text-default-500">
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-zinc-800 text-zinc-400 h-6 px-1"
                  >
                    {playlist.tracks_total} Tracks
                  </Chip>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
