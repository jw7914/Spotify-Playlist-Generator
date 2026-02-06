import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton, Card, CardHeader, CardBody } from "@heroui/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../services/api";

// --- Icons ---
const PlaylistIcon = () => (
  <svg
    className="w-6 h-6 text-white"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
    />
  </svg>
);

const GenreIcon = () => (
  <svg
    className="w-6 h-6 text-white"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

const ArtistIcon = () => (
  <svg
    className="w-6 h-6 text-white"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
);

// --- Constants ---
const CHART_COLORS = [
  "#60A5FA", // Blue 400
  "#F472B6", // Pink 400
  "#34D399", // Emerald 400
  "#A78BFA", // Violet 400
  "#FBBF24", // Amber 400
  "#F87171", // Red 400
  "#2DD4BF", // Teal 400
];

// --- Types ---
interface GenreStat {
  name: string;
  count: number;
  percent: number;
  [key: string]: any;
}

export default function StatsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // --- Genres & Tracks State ---
  const [topGenres, setTopGenres] = useState<GenreStat[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("short_term");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Fetch Genres & Top Tracks
  useEffect(() => {
    if (isAuthenticated) {
      setGenresLoading(true);


      // Fetch Artists for Genres
      api.spotify.getTopArtists(timeRange, 50)
        .then((data) => {
          if (data.artists) {
            calculateGenres(data.artists);
          }
        })
        .catch((err) => console.error("Failed to load artists for genres", err))
        .finally(() => setGenresLoading(false));
        

    }
  }, [isAuthenticated, timeRange]);

  const calculateGenres = (artists: any[]) => {
    const genreCounts: { [key: string]: number } = {};
    let totalTags = 0;

    artists.forEach((artist) => {
      artist.genres.forEach((genre: string) => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        totalTags++;
      });
    });

    // Limit to top 6 for the Pie Chart to stay clean
    const sortedGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalTags > 0 ? (count / totalTags) * 100 : 0,
      }));

    setTopGenres(sortedGenres);
  };



  const getRangeTitle = () => {
    if (timeRange === "short_term") return "Last 4 Weeks";
    if (timeRange === "medium_term") return "Last 6 Months";
    return "All Time";
  };

  // Custom Tooltip for the Pie Chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl">
          <p className="font-bold capitalize text-white mb-1">
            {payload[0].name}
          </p>
          <p className="text-zinc-400 text-xs">
            Frequency: <span className="text-white">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading || !user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-12 w-full">
        <div className="mb-10 text-center">
             <h1 className="text-4xl font-black text-white tracking-tight mb-2">Your Stats</h1>
             <p className="text-zinc-400">Deep dive into your listening habits</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card
                isPressable
                onPress={() => navigate("/top-artists")}
                className="w-full bg-zinc-900/50 border border-zinc-800 hover:border-pink-500 transition-all duration-300 group p-5"
            >
                <CardHeader className="flex gap-4 p-0 mb-2">
                    <div className="p-3 bg-pink-500/10 rounded-xl text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                        <ArtistIcon />
                    </div>
                    <div className="flex flex-col text-left justify-center">
                        <p className="text-xl font-bold text-white">Top Artists</p>
                        <p className="text-xs text-zinc-400 uppercase tracking-wide">
                            Detailed Breakdown
                        </p>
                    </div>
                </CardHeader>
                <CardBody className="p-0 mt-4">
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        View detailed ranking of your top artists.
                    </p>
                </CardBody>
            </Card>

            <Card
                isPressable
                onPress={() => navigate("/top-tracks")}
                className="w-full bg-zinc-900/50 border border-zinc-800 hover:border-violet-500 transition-all duration-300 group p-5"
            >
                <CardHeader className="flex gap-4 p-0 mb-2">
                    <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                        <PlaylistIcon />
                    </div>
                    <div className="flex flex-col text-left justify-center">
                        <p className="text-xl font-bold text-white">Top Tracks</p>
                        <p className="text-xs text-zinc-400 uppercase tracking-wide">
                            Detailed Breakdown
                        </p>
                    </div>
                </CardHeader>
                <CardBody className="p-0 mt-4">
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        View detailed ranking of your top tracks.
                    </p>
                </CardBody>
            </Card>
        </div>

        {/* --- Top Genres Pie Chart Section --- */}
        <div className="mb-16">
          <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <GenreIcon /> Top Genres
              <span className="text-zinc-500 font-normal text-xl">
                ({getRangeTitle()})
              </span>
            </h2>

            {/* Tabs */}
            <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setTimeRange("short_term")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeRange === "short_term"
                    ? "bg-zinc-700 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Last 4 Weeks
              </button>
              <button
                onClick={() => setTimeRange("medium_term")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeRange === "medium_term"
                    ? "bg-zinc-700 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Last 6 Months
              </button>
              <button
                onClick={() => setTimeRange("long_term")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeRange === "long_term"
                    ? "bg-zinc-700 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                All Time
              </button>
            </div>
          </div>

          <div className="w-full bg-zinc-900/30 border border-zinc-800 rounded-2xl p-8">
            {genresLoading ? (
              <div className="flex justify-center items-center h-[300px]">
                <Skeleton className="rounded-full w-64 h-64 bg-zinc-800" />
              </div>
            ) : topGenres.length === 0 ? (
              <div className="text-center py-10 text-zinc-500">
                Not enough data to determine genres for this period.
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                {/* 1. The Pie Chart */}
                <div className="w-full md:w-1/2 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topGenres}
                        cx="50%"
                        cy="50%"
                        innerRadius={60} // Donut Chart
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        stroke="none"
                      >
                        {topGenres.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 2. Custom Legend/List */}
                <div className="w-full md:w-1/2 flex flex-col justify-center gap-3">
                  {topGenres.map((genre, index) => (
                    <div
                      key={genre.name}
                      className="flex items-center justify-between group p-2 hover:bg-zinc-800/50 rounded-lg transition-colors cursor-default"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                          style={{
                            backgroundColor:
                              CHART_COLORS[index % CHART_COLORS.length],
                            color: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <span className="text-zinc-200 capitalize font-medium">
                          {genre.name}
                        </span>
                      </div>
                      <span className="text-zinc-500 text-sm font-mono">
                        {genre.count} hits
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}
