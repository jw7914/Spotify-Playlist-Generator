import { Navbar } from "@/components/navbar";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Image } from "@heroui/image";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Skeleton } from "@heroui/skeleton";
import { CircularProgress } from "@heroui/progress";
import { Trophy, ExternalLink, Mic2, TrendingUp, Music } from "lucide-react";

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
    setError(null);
    setArtists([]);

    const fetchTopArtists = async () => {
      try {
        const res = await fetch("/api/top-artists", { redirect: "manual" });

        if (
          res.type === "opaqueredirect" ||
          (res.status >= 300 && res.status < 400)
        ) {
          navigate("/login", { replace: true });
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Failed to fetch: ${res.statusText}`
          );
        }

        const data = await res.json();
        setArtists(data.artists || []);
      } catch (err: any) {
        setError(err.message || "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchTopArtists();
  }, [navigate]);

  const featured = artists[0];
  const restOfArtists = artists.slice(1);

  const renderSkeletons = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {Array(10)
        .fill(0)
        .map((_, i) => (
          <Card
            key={i}
            className="bg-zinc-800 border border-zinc-700 p-4 space-y-4"
            radius="lg"
          >
            <Skeleton className="rounded-full w-32 h-32 mx-auto" />
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
            </div>
          </Card>
        ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-purple-500/10 rounded-full text-purple-400">
            <Mic2 size={24} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Your Top Artists
          </h1>
        </div>

        {error && (
          <div className="w-full p-4 mb-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
            <Music size={20} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-12">
            <Skeleton className="w-full h-[300px] rounded-3xl bg-zinc-800" />
            {renderSkeletons()}
          </div>
        ) : artists.length > 0 ? (
          <>
            {/* --- Hero Section: #1 Artist --- */}
            <section className="relative w-full overflow-hidden rounded-[32px] bg-gradient-to-r from-violet-900 via-indigo-900 to-black border border-white/10 shadow-2xl mb-16 group">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

              <div className="relative z-10 flex flex-col md:flex-row items-center p-8 md:p-12 gap-8 md:gap-16">
                {/* Artist Image */}
                <div className="relative shrink-0">
                  <div className="w-48 h-48 md:w-64 md:h-64 rounded-full p-2 border-2 border-white/10 bg-black/20 backdrop-blur-sm">
                    <Image
                      src={featured.images[0]?.url}
                      alt={featured.name}
                      className="w-full h-full object-cover rounded-full shadow-[0_0_50px_rgba(139,92,246,0.3)] group-hover:scale-105 transition-transform duration-500"
                      width="100%"
                      height="100%"
                    />
                  </div>
                </div>

                {/* Artist Info */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4 max-w-2xl">
                  {/* FIX: Moved Badge Here (Inside content flow, no overlap) */}
                  <Chip
                    startContent={
                      <Trophy size={14} className="text-yellow-400" />
                    }
                    variant="shadow"
                    classNames={{
                      base: "bg-black/40 border border-yellow-500/30 backdrop-blur-md pl-2 pr-4 mb-2",
                    }}
                  >
                    <span className="text-yellow-400 font-bold tracking-wider">
                      #1 MOST PLAYED
                    </span>
                  </Chip>

                  <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">
                    {featured.name}
                  </h2>

                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {featured.genres.slice(0, 3).map((g) => (
                      <Chip
                        key={g}
                        size="sm"
                        variant="flat"
                        className="bg-white/10 text-zinc-100 capitalize"
                      >
                        {g}
                      </Chip>
                    ))}
                  </div>

                  <div className="pt-4 flex items-center gap-4">
                    <Button
                      as="a"
                      href={featured.external_url}
                      target="_blank"
                      className="bg-[#1DB954] text-black font-bold shadow-lg hover:bg-[#1ed760]"
                      endContent={<ExternalLink size={16} />}
                      size="lg"
                      radius="full"
                    >
                      Listen on Spotify
                    </Button>
                    <div className="flex items-center gap-2 text-zinc-300 text-sm px-4">
                      <TrendingUp size={16} className="text-green-400" />
                      <span>Popularity: {featured.popularity}/100</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* --- Grid Section: Top 2-X --- */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-zinc-100 pl-2 border-l-4 border-purple-500">
                The Heavy Rotation
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {restOfArtists.map((artist, index) => (
                  <Card
                    key={artist.id}
                    isPressable
                    onPress={() => window.open(artist.external_url, "_blank")}
                    className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700/80 transition-all group pt-6"
                    shadow="sm"
                  >
                    <CardBody className="overflow-visible py-2 flex flex-col items-center">
                      <div className="w-32 h-32 rounded-full overflow-hidden shadow-xl mb-4 relative group-hover:ring-4 ring-purple-500/30 transition-all">
                        <Image
                          alt={artist.name}
                          className="object-cover w-full h-full"
                          src={artist.images[0]?.url || "/vite.svg"}
                          width="100%"
                          height="100%"
                        />
                      </div>

                      <h4 className="font-bold text-large text-center text-white line-clamp-1 w-full px-1">
                        {artist.name}
                      </h4>

                      <p className="text-tiny text-zinc-300 uppercase tracking-wider font-bold mt-1 mb-3">
                        #{index + 2} in your top
                      </p>

                      <div className="flex flex-wrap justify-center gap-1 w-full px-2 h-12 overflow-hidden content-start">
                        {artist.genres.slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="text-[10px] text-zinc-100 bg-zinc-700 border border-zinc-600 px-2 py-0.5 rounded-full capitalize truncate max-w-[90%]"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </CardBody>

                    <CardFooter className="justify-center pt-0 pb-6">
                      {artist.popularity !== undefined && (
                        <div
                          className="flex items-center gap-2"
                          title={`Popularity Score: ${artist.popularity}`}
                        >
                          <CircularProgress
                            aria-label="Popularity"
                            size="sm"
                            value={artist.popularity}
                            color={
                              artist.popularity > 80
                                ? "success"
                                : artist.popularity > 50
                                  ? "warning"
                                  : "default"
                            }
                            showValueLabel={false}
                            classNames={{
                              svg: "w-5 h-5",
                              indicator: "stroke-[3px]",
                              track: "stroke-[3px] stroke-zinc-600",
                            }}
                          />
                          <span className="text-tiny text-zinc-300 font-medium">
                            {artist.popularity}% Pop
                          </span>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-zinc-500">
            <Mic2 size={48} className="mx-auto mb-4 opacity-20" />
            <p>No artists found for this time period.</p>
          </div>
        )}
      </main>
    </div>
  );
}
