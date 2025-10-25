import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Playlist {
  id: string;
  name: string;
  owner: string;
  tracks_total: number;
  images: { url: string }[];
  external_url: string;
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    fetch("/api/playlists", { redirect: "manual" })
      .then(async (res) => {
        if (
          res.type === "opaqueredirect" ||
          (res.status >= 300 && res.status < 400)
        ) {
          navigate("/login", { replace: true });
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch playlists");
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setPlaylists(data.playlists || []);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading)
    return <div className="text-center mt-10">Loading playlists...</div>;
  if (error)
    return <div className="text-center mt-10 text-red-500">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your Spotify Playlists</h1>
      {playlists.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No playlists found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <a
              key={playlist.id}
              href={playlist.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-card rounded-lg shadow hover:shadow-lg transition p-4 group"
            >
              <img
                src={playlist.images[0]?.url || "/vite.svg"}
                alt={playlist.name}
                className="w-full h-40 object-cover rounded mb-3 group-hover:scale-105 transition"
              />
              <div className="font-semibold text-lg mb-1">{playlist.name}</div>
              <div className="text-sm text-muted-foreground mb-1">
                Owner: {playlist.owner}
              </div>
              <div className="text-xs text-muted-foreground">
                {playlist.tracks_total} tracks
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
