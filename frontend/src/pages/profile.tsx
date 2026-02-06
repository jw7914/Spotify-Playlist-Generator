import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Divider,
  Image,
  Skeleton,
} from "@heroui/react";

import { api } from "../services/api";

// --- Icons ---
const PlayIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg className={`w-8 h-8 fill-current ${className || ""}`} viewBox="0 0 24 24" {...props}>
       <path d="M8 5v14l11-7z" />
    </svg>
);

const PauseIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg className={`w-8 h-8 fill-current ${className || ""}`} viewBox="0 0 24 24" {...props}>
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

const SkipBackIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg className={`w-6 h-6 fill-current text-zinc-400 hover:text-white transition-colors ${className || ""}`} viewBox="0 0 24 24" {...props}>
        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
);

const SkipForwardIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg className={`w-6 h-6 fill-current text-zinc-400 hover:text-white transition-colors ${className || ""}`} viewBox="0 0 24 24" {...props}>
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
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




// --- Constants ---
// Vibrant colors for the chart slices


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

  // --- Currently Playing State ---
  const [currentlyPlaying, setCurrentlyPlaying] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // [NEW] Progress state
  const [playingLoading, setPlayingLoading] = useState(true);



  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // 1. Fetch Recently Played & Currently Playing
  useEffect(() => {
    if (isAuthenticated) {
      setRecentLoading(true);
      setPlayingLoading(true);

      // Fetch Recently Played
      api.spotify.getRecentlyPlayed(10)
        .then((data) => {
          if (data.items) setRecentTracks(data.items);
        })
        .catch((err) => console.error("Failed to load history", err))
        .finally(() => setRecentLoading(false));

       // Fetch Currently Playing immediately
       fetchCurrentlyPlaying();

       // Poll every 5 seconds
       const interval = setInterval(fetchCurrentlyPlaying, 5000);

       // Cleanup on unmount
       return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // [NEW] Effect to increment progress
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (isPlaying && currentlyPlaying) {
          interval = setInterval(() => {
              setProgress((prev) => {
                  if (prev >= currentlyPlaying.duration_ms) return prev;
                  return prev + 1000;
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [isPlaying, currentlyPlaying]);


  const fetchCurrentlyPlaying = () => {
    api.spotify.getCurrentlyPlaying()
      .then((data) => {
          if (data && data.item) {
              setCurrentlyPlaying(data.item);
              setIsPlaying(data.is_playing);
              // Only update progress from API if deviation is large or first load
              // But simplest way is just strict sync or sync if not recently updated. 
              // Let's strict sync for now to keep it simple, the 1s tick handles between polls.
              // Note: Polling every 5s might cause "jumps" if we overwrite local state constantly.
              // A simple approach: Always sync.
              setProgress(data.item.progress_ms || 0); 
          } else {
              setCurrentlyPlaying(null);
              setIsPlaying(false);
              setProgress(0);
          }
      })
      .catch((err) => console.error("Failed to load currently playing", err))
      .finally(() => setPlayingLoading(false));
  };
  
  const handleControl = async (action: "play" | "pause" | "next" | "previous") => {
      try {
            if (action === "play") await api.spotify.play();
            if (action === "pause") await api.spotify.pause();
            if (action === "next") await api.spotify.next();
            if (action === "previous") await api.spotify.previous();
            
            // Optimistic update for play/pause
            if (action === "play") setIsPlaying(true);
            if (action === "pause") setIsPlaying(false);
            
            // Refresh data after a short delay to allow API to update
            setTimeout(fetchCurrentlyPlaying, 500);
      } catch (error) {
          console.error("Player control failed", error);
      }
  };



  const formatTime = (ms: number) => {
      if (!ms && ms !== 0) return "--:--";
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (isLoading || !user) return null;
  const avatar = user.images?.[0]?.url || "/placeholder_avatar.svg";





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
          <div className="flex flex-col gap-3 items-center md:items-end md:ml-auto">
             <a
              href={user.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-full border border-white/20 hover:bg-white/10 hover:border-white transition text-xs font-bold tracking-widest bg-black text-center min-w-[200px]"
            >
              OPEN ON SPOTIFY
            </a>
            <button
               onClick={() => navigate("/playlists")}
               className="px-8 py-3 rounded-full bg-[#6A6BB5] hover:bg-[#5a5bb0] text-white transition text-xs font-bold tracking-widest min-w-[200px] shadow-[0_0_20px_rgba(106,107,181,0.3)]"
            >
               YOUR PLAYLISTS
            </button>
          </div>
        </div>

        <Divider className="my-10 bg-zinc-800" />




        {/* --- Currently Playing --- */}
        <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <PlayIcon /> Currently Playing
            </h2>
             {playingLoading ? (
                <Card className="w-full bg-zinc-900/30 border border-zinc-800 p-6">
                     <div className="flex items-center gap-4">
                        <Skeleton className="w-20 h-20 rounded-md bg-zinc-800" />
                        <div className="flex flex-col gap-2">
                             <Skeleton className="w-40 h-4 rounded-md bg-zinc-800" />
                             <Skeleton className="w-24 h-3 rounded-md bg-zinc-800" />
                        </div>
                     </div>
                </Card>
             ) : currentlyPlaying ? (
                 <Card className="w-full bg-zinc-900/30 border border-emerald-500/30 p-6 relative overflow-hidden group">
                     {/* Background blur effect */}
                     <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
                     
                     <div className="relative flex flex-col md:flex-row items-center gap-6 z-10 w-full">
                         <div className="relative w-24 h-24 flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                             {/* Synth Glow Effect */}
                             {isPlaying && (
                                 <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-purple-600 rounded-lg opacity-75 blur-lg animate-pulse"></div>
                             )}
                             <Image
                                 src={currentlyPlaying.album.image}
                                 alt={currentlyPlaying.album.name}
                                 className="relative object-cover w-full h-full rounded-md z-10 shadow-xl"
                                 radius="none"
                             />
                         </div>
                         
                         <div className="flex flex-col gap-1 min-w-0 flex-grow text-center md:text-left w-full md:w-auto">
                             <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                 <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                                     Now Playing
                                 </span>
                             </div>
                             <a 
                                 href={currentlyPlaying.external_url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="text-2xl font-bold text-white hover:underline truncate w-full block"
                             >
                                 {currentlyPlaying.name}
                             </a>
                             <p className="text-zinc-300 text-lg truncate mb-2">
                                 {currentlyPlaying.artists.map((a: any) => a.name).join(", ")}
                             </p>
                             
                             {/* Progress Bar & Time */}
                             <div className="flex flex-col gap-1 w-full max-w-md">
                                <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                                    <span>{formatTime(progress)}</span>
                                    <span>{formatTime(currentlyPlaying.duration_ms)}</span>
                                </div>
                                <div className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear"
                                        style={{ width: `${Math.min((progress / currentlyPlaying.duration_ms) * 100, 100)}%` }}
                                    />
                                </div>
                             </div>
                         </div>
                         
                         {/* Controls */}
                         <div className="flex items-center gap-4 md:mr-4 flex-shrink-0">
                             <button onClick={() => handleControl("previous")} className="p-2 hover:bg-white/10 rounded-full transition">
                                 <SkipBackIcon />
                             </button>
                             
                             <button 
                                onClick={() => handleControl(isPlaying ? "pause" : "play")}
                                className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center hover:scale-105 transition active:scale-95 text-white shadow-lg shadow-emerald-500/20"
                             >
                                 {isPlaying ? <PauseIcon /> : <PlayIcon className="ml-1" />}
                             </button>
                             
                             <button onClick={() => handleControl("next")} className="p-2 hover:bg-white/10 rounded-full transition">
                                <SkipForwardIcon />
                             </button>
                         </div>
                     </div>
                 </Card>
             ) : (
                <div className="w-full bg-zinc-900/30 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 flex flex-col items-center gap-2">
                    <span className="p-3 bg-zinc-800 rounded-full text-white">
                        <PlayIcon />
                    </span>
                    <p>Not playing anything right now.</p>
                </div>
             )}
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
      </div>
    </div>
  );
}
