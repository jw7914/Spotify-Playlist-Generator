import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DefaultLayout from "@/layouts/default";

interface Artist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
  popularity?: number;
  external_url?: string;
}

export default function TopArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    fetch("/api/top-artists", { redirect: "manual" })
      .then(async (res) => {
        if (
          res.type === "opaqueredirect" ||
          (res.status >= 300 && res.status < 400)
        ) {
          navigate("/login", { replace: true });
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch top artists");
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setArtists(data.artists || []);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading)
    return (
      <DefaultLayout>
        <div className="text-center mt-10">Loading top artists...</div>
      </DefaultLayout>
    );
  if (error)
    return (
      <DefaultLayout>
        <div className="text-center mt-10 text-red-500">{error}</div>
      </DefaultLayout>
    );

  const featured = artists[0];

  return (
    <DefaultLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero section */}
        <section className="relative rounded-lg overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 text-white mb-8">
          <div className="absolute inset-0 opacity-20 bg-[url('/vite.svg')] bg-cover mix-blend-overlay" />
          <div className="relative z-10 px-6 py-16">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Your Top Artists
            </h1>
            <p className="mt-3 text-lg md:text-xl text-white/90 max-w-2xl">
              A snapshot of the artists you listen to the most. Explore and open
              their Spotify pages.
            </p>

            {featured && (
              <div className="mt-8 flex flex-col md:flex-row items-center gap-6">
                <div className="w-48 h-48 md:w-56 md:h-56 rounded-lg overflow-hidden shadow-lg">
                  <img
                    src={featured.images[0]?.url || "/vite.svg"}
                    alt={featured.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">
                    {featured.name}
                  </h2>
                  <div className="text-sm text-white/90 mt-2">
                    {featured.genres?.slice(0, 3).join(" • ")}
                  </div>
                  <div className="mt-4">
                    <a
                      href={featured.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-white text-violet-600 font-semibold px-4 py-2 rounded shadow"
                    >
                      Open on Spotify
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Grid of artists */}
        <section>
          <h3 className="text-2xl font-bold mb-4">All Top Artists</h3>
          {artists.length === 0 ? (
            <div className="text-muted-foreground">No artists found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {artists.map((artist) => (
                <a
                  key={artist.id}
                  href={artist.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-card rounded-lg shadow hover:shadow-lg transition p-4 group"
                >
                  <div className="w-full h-40 rounded overflow-hidden mb-3">
                    <img
                      src={artist.images[0]?.url || "/vite.svg"}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="font-semibold text-lg mb-1">
                    {artist.name}
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {artist.genres?.slice(0, 2).join(", ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Popularity: {artist.popularity ?? "—"}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </DefaultLayout>
  );
}
