import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardFooter,
  Image,
  Button,
  Chip,
  Skeleton,
  Select,
  SelectItem,
} from "@heroui/react";
import {
  Trophy,
  ExternalLink,
  Mic2,
  Music,
  ListFilter,
  CalendarClock,
} from "lucide-react";

import { api, AuthError } from "../services/api";

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

  // State for controls
  const [limit, setLimit] = useState<string>("20");
  const [timeRange, setTimeRange] = useState<string>("short_term");

  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Don't clear artists immediately to avoid "flash" if you prefer,
    // but clearing ensures the skeleton shows which feels more responsive to the change.
    setArtists([]);

    const fetchTopArtists = async () => {
      try {
        const data = await api.spotify.getTopArtists(timeRange, limit);
        setArtists(data.artists || []);
      } catch (err: any) {
        if (err instanceof AuthError) {
           navigate("/login", { replace: true });
        } else {
           setError(err.message || "An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTopArtists();
  }, [navigate, limit, timeRange]); // Refetch when limit or timeRange changes

  const featured = artists[0];
  const restOfArtists = artists.slice(1);

  const renderSkeletons = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {Array(Math.max(0, parseInt(limit) - 1))
        .fill(0)
        .map((_, i) => (
          <Card
            key={i}
            className="bg-zinc-800 border border-zinc-700 p-4 space-y-4"
            radius="lg"
          >
            <Skeleton className="rounded-full w-32 h-32 mx-auto bg-zinc-700" />
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-4 w-3/4 rounded-lg bg-zinc-700" />
              <Skeleton className="h-3 w-1/2 rounded-lg bg-zinc-700" />
            </div>
          </Card>
        ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-full text-purple-400">
              <Mic2 size={24} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Your Top Artists
            </h1>
          </div>

          {/* Controls Container */}
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            {/* Time Range Selector */}
            <Select
              label="Time Period"
              placeholder="Select period"
              selectedKeys={[timeRange]}
              className="w-full sm:w-48"
              startContent={
                <CalendarClock size={16} className="text-zinc-400" />
              }
              onChange={(e) => {
                if (e.target.value) setTimeRange(e.target.value);
              }}
              disallowEmptySelection
              variant="bordered"
              classNames={{
                trigger:
                  "bg-zinc-900 border-zinc-700 hover:border-purple-500 text-white",
                value: "text-white group-data-[has-value=true]:text-white",
                popoverContent: "bg-zinc-900 border border-zinc-800 text-white",
                label: "text-zinc-400",
              }}
            >
              <SelectItem key="short_term" textValue="Last 4 Weeks">
                Last 4 Weeks
              </SelectItem>
              <SelectItem key="medium_term" textValue="Last 6 Months">
                Last 6 Months
              </SelectItem>
              <SelectItem key="long_term" textValue="All Time">
                All Time
              </SelectItem>
            </Select>

            {/* Limit Selector */}
            <Select
              label="Display Limit"
              placeholder="Select amount"
              selectedKeys={[limit]}
              className="w-full sm:w-40"
              startContent={<ListFilter size={16} className="text-zinc-400" />}
              onChange={(e) => {
                if (e.target.value) setLimit(e.target.value);
              }}
              disallowEmptySelection
              variant="bordered"
              classNames={{
                trigger:
                  "bg-zinc-900 border-zinc-700 hover:border-purple-500 text-white",
                value: "text-white group-data-[has-value=true]:text-white",
                popoverContent: "bg-zinc-900 border border-zinc-800 text-white",
                label: "text-zinc-400",
              }}
            >
              <SelectItem key="10" textValue="Top 10">
                Top 10
              </SelectItem>
              <SelectItem key="20" textValue="Top 20">
                Top 20
              </SelectItem>
              <SelectItem key="50" textValue="Top 50">
                Top 50
              </SelectItem>
            </Select>
          </div>
        </div>

        {error && (
          <div className="w-full p-4 mb-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
            <Music size={20} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-12 animate-pulse">
            <Skeleton className="w-full h-[300px] rounded-[32px] bg-zinc-800" />
            {renderSkeletons()}
          </div>
        ) : artists.length > 0 ? (
          <>
            {/* --- Hero Section: #1 Artist --- */}
            {/* --- Hero Section: #1 Artist --- */}
            <section className="relative w-full overflow-hidden rounded-[40px] bg-gradient-to-br from-violet-900/80 via-zinc-900 to-black border border-white/10 shadow-2xl mb-16 group isolate">
              {/* Background Ambient Glows */}
              <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen -z-10" />
              <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen -z-10" />

              <div className="relative z-10 flex flex-col md:flex-row items-center p-8 md:p-16 gap-10 md:gap-20">
                {/* ---- FIXED ARTIST IMAGE ---- */}
                <div className="relative shrink-0 flex justify-center">
                  {/* 1. The Back Glow Layer - sits behind the image */}
                  <div className="absolute inset-2 bg-purple-500/40 blur-[50px] rounded-[3rem] transform scale-95 group-hover:scale-110 transition-transform duration-700 ease-out -z-10" />

                  {/* 2. The Image Component */}
                  <Image
                    src={featured?.images[0]?.url}
                    alt={featured?.name}
                    // Made much bigger (w-96 on desktop), changed from circle to large rounded corners.
                    // Added a heavy, specific purple shadow.
                    className="w-72 h-72 md:w-[400px] md:h-[400px] object-cover shadow-[0_25px_60px_-12px_rgba(147,51,234,0.6)]"
                    // Important HeroUI styling overrides:
                    classNames={{
                      // Ensure the wrapper matches the image rounding and allows the shadow to spill out
                      wrapper:
                        "rounded-[2.5rem] md:rounded-[3.5rem] overflow-visible",
                      // Smooth hover lift effect on the image itself
                      img: "rounded-[2.5rem] md:rounded-[3.5rem] group-hover:scale-[1.02] transition-transform duration-500 ease-out",
                    }}
                  />
                </div>
                {/* --------------------------- */}

                {/* Artist Info */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6 max-w-2xl flex-grow">
                  <Chip
                    startContent={
                      <Trophy
                        size={16}
                        className="text-yellow-400 fill-yellow-400/20"
                      />
                    }
                    variant="shadow"
                    classNames={{
                      base: "bg-black/60 border border-yellow-500/30 backdrop-blur-xl pl-3 pr-5 py-2 h-auto",
                    }}
                  >
                    <span className="text-yellow-400 font-extrabold tracking-wider text-sm">
                      #1 MOST PLAYED
                    </span>
                  </Chip>

                  <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-purple-200">
                    {featured?.name}
                  </h2>

                  <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    {featured?.genres.slice(0, 3).map((g) => (
                      <Chip
                        key={g}
                        size="md"
                        variant="flat"
                        className="bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-200 capitalize backdrop-blur-md transition-colors"
                      >
                        {g}
                      </Chip>
                    ))}
                  </div>

                  <div className="pt-6 flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto">
                    <Button
                      as="a"
                      href={featured?.external_url}
                      target="_blank"
                      className="bg-[#1DB954] text-black font-bold shadow-[0_10px_30px_-10px_rgba(29,185,84,0.5)] hover:bg-[#1ed760] hover:shadow-[0_15px_40px_-10px_rgba(29,185,84,0.7)] transition-all w-full sm:w-auto"
                      endContent={<ExternalLink size={18} />}
                      size="lg"
                      radius="full"
                    >
                      Listen on Spotify
                    </Button>
                    <div className="flex flex-col gap-1 pl-4 border-l border-white/10">
                      <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold">
                        Popularity
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-black tracking-tighter ${featured?.popularity && featured.popularity > 80 ? 'text-green-400' : 'text-white'}`}>
                          {featured?.popularity ?? 0}
                        </span>
                        <span className="text-sm text-zinc-500 font-bold">/ 100</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* --- Grid Section: Top 2-X --- */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-l-4 border-purple-500 pl-4">
                <h3 className="text-2xl font-bold text-zinc-100">
                  Additional Artists
                </h3>
                <span className="text-sm text-zinc-400 hidden sm:block">
                  Showing {artists.length} artists based on your{" "}
                  {timeRange.replace("_", " ")} listening
                </span>
              </div>

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
                        <div className="w-full px-4 flex flex-col gap-1.5" title={`Popularity Score: ${artist.popularity}`}>
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Popularity Meter</span>
                            <span className={`text-xs font-bold ${artist.popularity > 80 ? 'text-green-400' : artist.popularity > 60 ? 'text-yellow-400' : 'text-zinc-400'}`}>
                              {artist.popularity}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-700/50 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${artist.popularity > 80 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : artist.popularity > 60 ? 'bg-yellow-500' : 'bg-zinc-500'} transition-all duration-1000 ease-out`}
                              style={{ width: `${artist.popularity}%` }}
                            />
                          </div>
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
