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
import { Music } from "lucide-react";
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
  
  // --- Queue State ---
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);



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


       // Fetch Currently Playing & Queue immediately
       fetchCurrentlyPlaying();
       fetchQueue();

       // Poll every 5 seconds
       const interval = setInterval(() => {
           fetchCurrentlyPlaying();
           fetchQueue();
       }, 5000);

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

  const fetchQueue = () => {
      api.spotify.getQueue()
          .then((data) => {
              if (data && data.queue) {
                  setQueue(data.queue);
              }
          })
          .catch((err) => console.error("Failed to load queue", err))
          .finally(() => setQueueLoading(false));
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




        {/* --- Media Player (Now Playing + Queue) --- */}
        <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <PlayIcon /> Media Player
            </h2>
            <Card className={`relative w-full bg-zinc-900/80 border overflow-hidden min-h-[400px] transition-all duration-1000 group/card ${isPlaying ? "border-emerald-500/50 shadow-[0_0_100px_rgba(16,185,129,0.25)]" : "border-zinc-800"}`}>
                {/* Global Breathing Glow Background - Intensified */}
                {isPlaying && (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-purple-900/20 to-emerald-900/20 animate-pulse pointer-events-none duration-[4000ms] z-0"></div>
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-purple-600/20 blur-2xl opacity-50 animate-pulse pointer-events-none z-0"></div>
                    </>
                )}
                
                <div className="flex flex-col lg:flex-row h-full relative z-10 backdrop-blur-sm">
                    
                    {/* LEFT: Currently Playing */}
                    <div className="w-full lg:w-1/2 p-8 border-b lg:border-b-0 lg:border-r border-zinc-800 relative group flex flex-col justify-center">
                        {playingLoading ? (
                            <div className="flex items-center gap-6">
                                <Skeleton className="w-32 h-32 rounded-lg bg-zinc-800" />
                                <div className="flex flex-col gap-3">
                                     <Skeleton className="w-48 h-6 rounded-md bg-zinc-800" />
                                     <Skeleton className="w-32 h-4 rounded-md bg-zinc-800" />
                                </div>
                            </div>
                        ) : currentlyPlaying ? (
                            <>
                                {/* Background blur effect */}
                                <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors duration-500 pointer-events-none"></div>
                                
                                <div className="relative flex flex-col md:flex-row items-center gap-8 z-10 w-full">
                                     <div className="relative w-40 h-40 flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                                         {isPlaying && (
                                             <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-purple-600 rounded-xl opacity-100 blur-3xl animate-pulse"></div>
                                         )}
                                         <Image
                                             src={currentlyPlaying.album.image}
                                             alt={currentlyPlaying.album.name}
                                             className="relative object-cover w-full h-full rounded-lg z-10 shadow-2xl"
                                             radius="none"
                                         />
                                     </div>
                                     
                                     <div className="flex flex-col gap-2 min-w-0 flex-grow text-center md:text-left w-full md:w-auto">
                                         <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                             <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                                                 Now Playing
                                             </span>
                                         </div>
                                         <a 
                                             href={currentlyPlaying.external_url}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             className="text-3xl font-black text-white hover:underline truncate w-full block tracking-tight"
                                         >
                                             {currentlyPlaying.name}
                                         </a>
                                         <p className="text-zinc-300 text-xl truncate mb-4 font-medium">
                                             {currentlyPlaying.artists.map((a: any) => a.name).join(", ")}
                                         </p>
                                         
                                         {/* Progress Bar & Time */}
                                         <div className="flex flex-col gap-2 w-full max-w-md">
                                            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                                                <span>{formatTime(progress)}</span>
                                                <span>{formatTime(currentlyPlaying.duration_ms)}</span>
                                            </div>
                                            <div className="w-full h-2 bg-zinc-700/50 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                                    style={{ width: `${Math.min((progress / currentlyPlaying.duration_ms) * 100, 100)}%` }}
                                                />
                                            </div>
                                         </div>
                                     </div>
                                </div>
                                
                                {/* Controls - Bottom Positioned & Centered */}
                                <div className="mt-8 flex items-center justify-center gap-8 z-10 w-full">
                                     <button onClick={() => handleControl("previous")} className="p-3 hover:bg-white/10 rounded-full transition group/btn">
                                         <SkipBackIcon className="w-8 h-8 group-hover/btn:text-white" />
                                     </button>
                                     
                                     <button 
                                        onClick={() => handleControl(isPlaying ? "pause" : "play")}
                                        className="w-16 h-16 bg-emerald-500 hover:bg-emerald-400 rounded-full flex items-center justify-center hover:scale-105 transition active:scale-95 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                                     >
                                         {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="ml-1 w-8 h-8" />}
                                     </button>
                                     
                                     <button onClick={() => handleControl("next")} className="p-3 hover:bg-white/10 rounded-full transition group/btn">
                                        <SkipForwardIcon className="w-8 h-8 group-hover/btn:text-white" />
                                     </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-zinc-500 gap-4">
                                <span className="p-6 bg-zinc-800 rounded-full text-zinc-400">
                                    <PlayIcon className="w-10 h-10" />
                                </span>
                                <div className="flex flex-col gap-1">
                                    <p className="text-xl font-bold text-white">No Music Playing</p>
                                    <p className="text-sm">Start listening on Spotify to see it here.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Queue / Up Next */}
                    <div className="w-full lg:w-1/2 flex flex-col bg-black/40 backdrop-blur-sm border-l border-zinc-800">
                        <div className="p-6 border-b border-zinc-800/50 flex items-center gap-3 bg-zinc-900/20">
                             <Music className="w-5 h-5 text-emerald-500" /> 
                             <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Up Next</h3>
                        </div>
                        
                        <div className="flex-1 p-4 overflow-y-auto max-h-[450px] scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                             {queueLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="w-full h-16 rounded-lg bg-zinc-800/50" />)}
                                </div>
                             ) : queue.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 min-h-[300px]">
                                    <Music className="w-8 h-8 opacity-20" />
                                    <p className="text-sm font-medium">Queue is empty</p>
                                </div>
                             ) : (
                                 <div className="flex flex-col gap-2">
                                     {queue.slice(0, 10).map((track, i) => (
                                         <div key={`${track.id}-${i}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition group border border-transparent hover:border-zinc-800">
                                             <span className="w-6 text-center text-zinc-600 font-mono text-sm font-bold group-hover:text-emerald-500 transition-colors">
                                                 {i + 1}
                                             </span>
                                             <div className="relative w-12 h-12 flex-shrink-0 shadow-lg">
                                                 <img 
                                                    src={track.album?.images?.[0]?.url || "/placeholder_album.svg"} 
                                                    alt={track.name}
                                                    className="w-full h-full rounded object-cover"
                                                 />
                                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded"></div>
                                             </div>
                                             
                                             <div className="flex-1 min-w-0 py-1">
                                                 <p className="text-white text-base font-bold truncate group-hover:text-emerald-400 transition-colors">
                                                     {track.name}
                                                 </p>
                                                 <p className="text-zinc-400 text-xs font-medium truncate">
                                                     {track.artists?.map((a: any) => a.name).join(", ")}
                                                 </p>
                                             </div>
                                             <span className="text-zinc-600 text-xs font-mono ml-2">
                                                 {formatTime(track.duration_ms)}
                                             </span>
                                         </div>
                                     ))}
                                     {queue.length > 10 && (
                                         <div className="text-center py-4 border-t border-zinc-800/50 mt-2">
                                             <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                                 + {queue.length - 10} more tracks
                                             </p>
                                         </div>
                                     )}
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </Card>
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
