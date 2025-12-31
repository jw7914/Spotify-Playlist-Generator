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

// Icons
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

// --- Helper: Relative Time ---
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Fetch recently played
  useEffect(() => {
    if (isAuthenticated) {
      setRecentLoading(true);
      // Fetching 10 items for the horizontal scroll
      fetch("/api/recently-played?limit=10")
        .then((res) => res.json())
        .then((data) => {
          if (data.items) setRecentTracks(data.items);
        })
        .catch((err) => console.error("Failed to load history", err))
        .finally(() => setRecentLoading(false));
    }
  }, [isAuthenticated]);

  if (isLoading || !user) return null;

  const avatar = user.images?.[0]?.url || "/placeholder_avatar.svg";

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-12 w-full">
        {/* --- Header Section --- */}
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

        {/* --- Main Dashboard Grid (Playlists & Artists) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card 1: Playlists */}
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

          {/* Card 2: Top Artists */}
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

        {/* --- Recently Played (Horizontal Full Width) --- */}
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
                      <Skeleton className="w-3/4 h-4 rounded bg-zinc-800" />
                      <Skeleton className="w-1/2 h-3 rounded bg-zinc-800" />
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

        {/* --- Account / Footer --- */}
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
