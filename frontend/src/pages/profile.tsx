import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody, Divider } from "@heroui/react";

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

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !user) return null;

  const avatar = user.images?.[0]?.url || "/placeholder_avatar.svg";

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 w-full">
        {/* --- Header Section --- */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 mb-12">
          <img
            src={avatar}
            alt="Profile"
            className="w-32 h-32 rounded-full border-4 border-[#6A6BB5] shadow-2xl"
          />
          <div className="text-center md:text-left mb-2">
            <h5 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              Profile
            </h5>
            <h1 className="text-5xl font-black text-white mb-2">
              {user.display_name}
            </h1>
            <p className="text-zinc-400">{user.email}</p>
          </div>
          <div className="flex-grow" />
          <a
            href={user.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 rounded-full border border-white/30 hover:bg-white/10 transition text-sm font-bold tracking-wide"
          >
            OPEN PROFILE ON SPOTIFY
          </a>
        </div>

        <Divider className="my-8 bg-zinc-800" />

        {/* --- Dashboard Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Playlists - Clean Static Look */}
          <Card
            isPressable
            onPress={() => navigate("/playlists")}
            className="bg-zinc-900 border border-zinc-800 p-4"
          >
            <CardHeader className="flex gap-3">
              <div className="p-2 bg-[#6A6BB5]/20 rounded-lg text-[#6A6BB5]">
                <PlaylistIcon />
              </div>
              <div className="flex flex-col text-left">
                <p className="text-lg font-bold text-white">Your Playlists</p>
                <p className="text-small text-zinc-400">
                  View and manage your library
                </p>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-zinc-500 text-sm">
                Browse your created playlists and see track counts.
              </p>
            </CardBody>
          </Card>

          {/* Card 2: Top Artists - Clean Static Look */}
          <Card
            isPressable
            onPress={() => navigate("/top-artists")}
            className="bg-zinc-900 border border-zinc-800 p-4"
          >
            <CardHeader className="flex gap-3">
              <div className="p-2 bg-pink-500/20 rounded-lg text-pink-500">
                <ArtistIcon />
              </div>
              <div className="flex flex-col text-left">
                <p className="text-lg font-bold text-white">Top Artists</p>
                <p className="text-small text-zinc-400">
                  See who you listen to most
                </p>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-zinc-500 text-sm">
                Check out your listening trends and popularity scores.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* --- Settings / Logout --- */}
        <div className="mt-12 pt-8 border-t border-zinc-800">
          <h2 className="text-xl font-bold mb-4">Account</h2>
          <button
            onClick={() => navigate("/logout")}
            className="text-red-500 hover:text-red-400 font-semibold text-sm transition"
          >
            Sign out of App
          </button>
        </div>
      </div>
    </div>
  );
}
