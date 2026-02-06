import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Skeleton,
  Select,
  SelectItem,
  User,
  Button,
} from "@heroui/react";
import {
  Music,
  ListFilter,
  CalendarClock,
  Clock,
  Disc,
  ArrowLeft,
} from "lucide-react";

import { api, AuthError } from "../services/api";

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    image: string;
  };
  duration_ms: number;
  external_url: string;
  popularity?: number;
}

export default function TopTracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for controls
  const [limit, setLimit] = useState<string>("20");
  const [timeRange, setTimeRange] = useState<string>("short_term");

  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    setTracks([]);

    const fetchTopTracks = async () => {
      try {
        const data = await api.spotify.getTopTracks(timeRange, Number(limit));
        setTracks(data.tracks || []);
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

    fetchTopTracks();
  }, [navigate, limit, timeRange]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const renderSkeletons = () => (
    <div className="space-y-3">
        {Array(Math.max(0, parseInt(limit)))
            .fill(0)
            .map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg bg-zinc-900/30" />
            ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
      <div className="sticky top-0 z-50 bg-black/50 backdrop-blur-md px-6 py-4">
        <Button
          isIconOnly
          variant="light"
          className="text-zinc-400 hover:text-white"
          onPress={() => navigate("/stats")}
        >
          <ArrowLeft size={24} />
        </Button>
      </div>

      <main className="max-w-7xl mx-auto px-6 pb-12">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-full text-purple-400">
              <Disc size={24} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Your Top Tracks
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
             renderSkeletons()
        ) : tracks.length > 0 ? (
            <Table
                aria-label="Top Tracks"
                removeWrapper
                classNames={{
                th: "bg-transparent text-zinc-400 border-b border-zinc-800 hover:text-white transition-colors",
                td: "py-3 group-hover:bg-white/5 transition-colors cursor-default",
                tr: "group hover:bg-white/5 rounded-lg transition-colors border-b border-transparent hover:border-transparent",
                base: "overflow-visible",
                }}
            >
                <TableHeader>
                    <TableColumn className="w-10">#</TableColumn>
                    <TableColumn>Title</TableColumn>
                    <TableColumn className="hidden md:table-cell">Album</TableColumn>
                    <TableColumn className="w-20">
                        <Clock size={16} />
                    </TableColumn>
                </TableHeader>
                <TableBody emptyContent="No tracks found for this period.">
                    {tracks.map((track, index) => (
                    <TableRow
                        key={`${track.id}-${index}`}
                        className="hover:bg-white/10 cursor-pointer"
                        onClick={() => window.open(track.external_url, "_blank")}
                    >
                        <TableCell className="text-zinc-400 font-medium w-10">
                            {index + 1}
                        </TableCell>

                        <TableCell>
                            <User
                            name={track.name}
                            description={
                                <div className="text-zinc-400 group-hover:text-white transition-colors">
                                {track.artists.map((a) => a.name).join(", ")}
                                </div>
                            }
                            avatarProps={{
                                src: track.album?.image || "/vite.svg",
                                radius: "sm",
                                className: "w-10 h-10 mr-2",
                            }}
                            classNames={{
                                name: "text-white font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] md:max-w-xs",
                                description: "text-xs",
                            }}
                            />
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-zinc-400 hover:text-white transition-colors text-sm">
                            {track.album.name}
                        </TableCell>



                        <TableCell className="text-zinc-400 text-sm font-variant-numeric tabular-nums">
                            {formatTime(track.duration_ms)}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
        ) : (
          <div className="text-center py-20 text-zinc-500">
            <Music size={48} className="mx-auto mb-4 opacity-20" />
            <p>No tracks found for this time period.</p>
          </div>
        )}
      </main>
    </div>
  );
}
