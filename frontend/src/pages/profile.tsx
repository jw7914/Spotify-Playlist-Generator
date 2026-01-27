import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardBody,
  Divider,
  Image,
  Skeleton,
} from "@heroui/react";
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

const HistoryIcon = () => (
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
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
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

// --- Constants ---
// Vibrant colors for the chart slices
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
interface RecentTrack {
  played_at: string;
  track: {
    id: string;
    name: string;
    artists: { name: string }[];
    image: string;
    external_url: string;
  };
}

interface GenreStat {
  name: string;
  count: number;
  percent: number;
  [key: string]: any;
}

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return date.toLocaleDateString();
};

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // --- Genres State ---
  const [topGenres, setTopGenres] = useState<GenreStat[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [genreTimeRange, setGenreTimeRange] = useState("short_term");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // 1. Fetch Recently Played
  useEffect(() => {
    if (isAuthenticated) {
      setRecentLoading(true);
      api.spotify.getRecentlyPlayed(10)
        .then((data) => {
          if (data.items) setRecentTracks(data.items);
        })
        .catch((err) => console.error("Failed to load history", err))
        .finally(() => setRecentLoading(false));
    }
  }, [isAuthenticated]);

  // 2. Fetch Genres
  useEffect(() => {
    if (isAuthenticated) {
      setGenresLoading(true);
      api.spotify.getTopArtists(genreTimeRange, 50)
        .then((data) => {
          if (data.artists) {
            calculateGenres(data.artists);
          }
        })
        .catch((err) => console.error("Failed to load artists for genres", err))
        .finally(() => setGenresLoading(false));
    }
  }, [isAuthenticated, genreTimeRange]);

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

  if (isLoading || !user) return null;
  const avatar = user.images?.[0]?.url || "/placeholder_avatar.svg";

  const getRangeTitle = () => {
    if (genreTimeRange === "short_term") return "Last 4 Weeks";
    if (genreTimeRange === "medium_term") return "Last 6 Months";
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

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-12 w-full">
        {/* --- Header --- */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-12">
          <img
            src={avatar}
            alt="Profile"
            className="w-40 h-40 rounded-full border-4 border-[#6A6BB5] shadow-[0_0_30px_rgba(106,107,181,0.3)]"
          />
          <div className="text-center md:text-left mb-2">
            <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
              Profile
            </h5>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tight">
              {user.display_name}
            </h1>
            <p className="text-zinc-400 font-medium">{user.email}</p>
          </div>
          <div className="flex-grow" />
          <a
            href={user.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 rounded-full border border-white/20 hover:bg-white/10 hover:border-white transition text-xs font-bold tracking-widest bg-black"
          >
            OPEN ON SPOTIFY
          </a>
        </div>

        <Divider className="my-10 bg-zinc-800" />

        {/* --- Library Grid (2 Cols) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <Card
            isPressable
            onPress={() => navigate("/playlists")}
            className="bg-zinc-900/50 border border-zinc-800 hover:border-[#6A6BB5] transition-all duration-300 group p-5"
          >
            <CardHeader className="flex gap-4 p-0 mb-2">
              <div className="p-3 bg-[#6A6BB5]/10 rounded-xl text-[#6A6BB5] group-hover:bg-[#6A6BB5] group-hover:text-white transition-colors">
                <PlaylistIcon />
              </div>
              <div className="flex flex-col text-left justify-center">
                <p className="text-xl font-bold text-white">Your Playlists</p>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  Library Management
                </p>
              </div>
            </CardHeader>
            <CardBody className="p-0 mt-4">
              <p className="text-zinc-400 text-sm leading-relaxed">
                Access your full library, analyze track distributions, and
                manage your collections.
              </p>
            </CardBody>
          </Card>

          <Card
            isPressable
            onPress={() => navigate("/top-artists")}
            className="bg-zinc-900/50 border border-zinc-800 hover:border-pink-500 transition-all duration-300 group p-5"
          >
            <CardHeader className="flex gap-4 p-0 mb-2">
              <div className="p-3 bg-pink-500/10 rounded-xl text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                <ArtistIcon />
              </div>
              <div className="flex flex-col text-left justify-center">
                <p className="text-xl font-bold text-white">Top Artists</p>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  Listening Stats
                </p>
              </div>
            </CardHeader>
            <CardBody className="p-0 mt-4">
              <p className="text-zinc-400 text-sm leading-relaxed">
                Deep dive into your most listened artists over the last 4 weeks,
                6 months, or all time.
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
                onClick={() => setGenreTimeRange("short_term")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  genreTimeRange === "short_term"
                    ? "bg-zinc-700 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Last 4 Weeks
              </button>
              <button
                onClick={() => setGenreTimeRange("medium_term")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  genreTimeRange === "medium_term"
                    ? "bg-zinc-700 text-white shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Last 6 Months
              </button>
              <button
                onClick={() => setGenreTimeRange("long_term")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  genreTimeRange === "long_term"
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
                        innerRadius={60} // Makes it a Donut Chart
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

        {/* --- Recently Played --- */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <HistoryIcon /> Recently Played
          </h2>
          <Card className="w-full bg-zinc-900/30 border border-zinc-800 p-6">
            <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              {recentLoading ? (
                Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="min-w-[140px] space-y-3">
                      <Skeleton className="w-[140px] h-[140px] rounded-md bg-zinc-800" />
                    </div>
                  ))
              ) : recentTracks.length === 0 ? (
                <div className="w-full py-8 text-center text-zinc-500">
                  No recent history found.
                </div>
              ) : (
                recentTracks.map((item, i) => (
                  <a
                    key={`${item.track.id}-${i}`}
                    href={item.track.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group min-w-[140px] w-[140px] flex flex-col gap-3"
                  >
                    <div className="relative w-[140px] h-[140px] overflow-hidden rounded-md shadow-lg">
                      <Image
                        src={item.track.image}
                        alt={item.track.name}
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                        radius="none"
                      />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm truncate group-hover:text-emerald-400 transition-colors">
                        {item.track.name}
                      </p>
                      <p className="text-zinc-400 text-xs truncate">
                        {item.track.artists[0]?.name}
                      </p>
                      <p className="text-zinc-600 text-[10px] mt-1">
                        {getRelativeTime(item.played_at)}
                      </p>
                    </div>
                  </a>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* --- Footer --- */}
        <div className="border-t border-zinc-800 pt-8 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-white">Account Controls</h3>
            <p className="text-zinc-500 text-sm">Manage your session</p>
          </div>
          <button
            onClick={() => navigate("/logout")}
            className="px-6 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition font-semibold text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
