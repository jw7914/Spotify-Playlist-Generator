import { Navbar } from "@/components/navbar";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardFooter, Image } from "@heroui/react";

interface Playlist {
  id: string;
  name: string;
  owner: string;
  tracks_total: number;
  images: { url: string }[];
  external_url: string;
}

export default function PlaylistsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Protect the Route using useAuth
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // 2. Fetch Data
  useEffect(() => {
    if (!isAuthenticated) return; // Wait for auth

    fetch("/api/playlists")
      .then((res) => (res.ok ? res.json() : { playlists: [] })) // Simple error handling
      .then((data) => setPlaylists(data.playlists || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Your Spotify Playlists</h1>

        {loading ? (
          <div className="text-zinc-500">Loading playlists...</div>
        ) : playlists.length === 0 ? (
          <div className="text-zinc-500">No playlists found.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {playlists.map((playlist) => (
              <a
                key={playlist.id}
                href={playlist.external_url}
                target="_blank"
                rel="noreferrer"
                className="group"
              >
                <Card className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors">
                  <div className="aspect-square p-0 overflow-hidden">
                    <Image
                      removeWrapper
                      alt={playlist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={playlist.images[0]?.url || "/vite.svg"}
                    />
                  </div>
                  <CardFooter className="flex flex-col items-start px-4 py-3">
                    <p className="font-semibold text-white truncate w-full">
                      {playlist.name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {playlist.tracks_total} tracks
                    </p>
                  </CardFooter>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
