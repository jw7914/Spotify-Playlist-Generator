import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardFooter,
  Image,
  Button,
  Skeleton,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Switch,
  useDisclosure,
} from "@heroui/react";

import { ExternalLink, Music, Library, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  owner: string;
  tracks_total: number;
  images: { url: string }[] | null;
  external_url: string;
  public: boolean;
}

const DefaultPlaylistImage = () => (
  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
    <Music
      size={64}
      className="text-white opacity-50 scale-90 transition-transform duration-500 group-hover:scale-100"
    />
  </div>
);

import { api, AuthError } from "../services/api";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Create Playlist State
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Delete Playlist State
  const { 
    isOpen: isDeleteOpen, 
    onOpen: onDeleteOpen, 
    onOpenChange: onDeleteOpenChange 
  } = useDisclosure();
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Fetch Playlists Function
  const fetchPlaylists = () => {
    setLoading(true);
    api.spotify.getPlaylists()
      .then((data) => {
        if (!data) return;
        setPlaylists(data.playlists || []);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof AuthError) {
             navigate("/login", { replace: true });
        } else {
             setError(err.message || "Unknown error");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlaylists();
  }, [navigate]);

  const handleCreatePlaylist = async (onClose: () => void) => {
    if (!newPlaylistName.trim()) return;

    setCreating(true);
    try {
        await api.spotify.createPlaylist(newPlaylistName, newPlaylistDesc, isPublic);
        fetchPlaylists(); // Refresh list
        onClose();
        // Reset form
        setNewPlaylistName("");
        setNewPlaylistDesc("");
        setIsPublic(true);
        setToast({ message: "Playlist created successfully!", type: "success" });
    } catch (err: any) {
        console.error("Failed to create playlist", err);
        setToast({ message: "Failed to create playlist.", type: "error" });
    } finally {
        setCreating(false);
    }
  };

  const confirmDelete = async (onClose: () => void) => {
    if (!playlistToDelete) return;

    setDeleting(true);
    try {
        await api.spotify.deletePlaylist(playlistToDelete);
        fetchPlaylists();
        onClose();
        setPlaylistToDelete(null);
        setToast({ message: "Playlist deleted!", type: "success" });
    } catch (err) {
        console.error("Failed to delete playlist", err);
        setToast({ message: "Failed to delete playlist.", type: "error" });
    } finally {
        setDeleting(false);
    }
  };

  const promptDelete = (id: string) => {
      setPlaylistToDelete(id);
      onDeleteOpen();
  };

  const renderSkeletons = () =>
    Array(8)
      .fill(0)
      .map((_, i) => (
        <Card
          key={i}
          className="w-full space-y-5 p-4 bg-zinc-900/50 border border-zinc-800"
          radius="lg"
        >
          <Skeleton className="rounded-lg">
            <div className="h-40 rounded-lg bg-default-300" />
          </Skeleton>
          <div className="space-y-3">
            <Skeleton className="w-3/5 rounded-lg">
              <div className="h-3 w-3/5 rounded-lg bg-default-200" />
            </Skeleton>
            <Skeleton className="w-4/5 rounded-lg">
              <div className="h-3 w-4/5 rounded-lg bg-default-200" />
            </Skeleton>
          </div>
        </Card>
      ));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-4">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500">
          <Music size={48} />
        </div>
        <h2 className="text-xl font-bold">Unable to load library</h2>
        <p className="text-zinc-500">{error}</p>
        <Button color="primary" onPress={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-foreground">
      {/* Toast Notification */}
      {toast && (
          <div className={`fixed bottom-8 right-8 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === "success" ? "bg-zinc-900 border-green-500/50 text-white" : "bg-red-900/90 border-red-500/50 text-white"} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
              {toast.type === "success" ? <CheckCircle className="text-green-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
              <span className="font-medium">{toast.message}</span>
          </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-green-500">
              <Library size={20} />
              <span className="uppercase tracking-widest text-xs font-bold">
                Library
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white">Your Playlists</h1>
            <p className="text-zinc-400 mt-2">
              Select a playlist to analyze or generate new content from.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-zinc-500 text-sm font-medium">
                {loading ? "Syncing..." : `${playlists.length} Playlists Found`}
            </div>
            <Button 
                endContent={<Plus size={16} />}
                color="success"
                onPress={onOpen}
            >
                Create Playlist
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {loading ? (
            renderSkeletons()
          ) : playlists.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-500">
              <Music size={64} className="mb-4 opacity-20" />
              <p>No playlists found on your Spotify account.</p>
            </div>
          ) : (
            playlists.map((playlist) => (
              <Card
                key={playlist.id}
                isPressable
                className="group w-full bg-zinc-900/40 border border-white/5 hover:bg-zinc-800 transition-all duration-300"
                shadow="sm"
                // UPDATED: Navigates to internal route instead of external URL
                onPress={() => navigate(`/playlists/${playlist.id}`)}
              >
                <CardBody className="p-4 pb-2 overflow-visible relative">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-lg mb-4">
                    {playlist.images && playlist.images.length > 0 ? (
                      <Image
                        alt={playlist.name}
                        src={playlist.images[0].url}
                        className="object-cover w-full h-full"
                        radius="none"
                        width="100%"
                        height="100%"
                        classNames={{
                          wrapper: "w-full h-full",
                          img: "w-full h-full scale-100 group-hover:scale-105 transition-transform duration-500",
                        }}
                      />
                    ) : (
                      <DefaultPlaylistImage />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 backdrop-blur-[1px]">
                      <ExternalLink
                        size={48}
                        className="text-white drop-shadow-lg scale-90 group-hover:scale-100 transition-transform duration-300"
                      />
                    </div>
                  </div>

                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex w-full justify-between items-start gap-2">
                        <h3
                          className="font-bold text-white text-md line-clamp-1 flex-1"
                          title={playlist.name}
                        >
                          {playlist.name}
                        </h3>
                         <Chip
                            size="sm"
                            variant="flat"
                            className={`h-5 text-[10px] px-1 border ${
                                playlist.public 
                                ? "bg-zinc-800/50 text-zinc-400 border-zinc-700" 
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            }`}
                        >
                            {playlist.public ? "Public" : "Private"}
                        </Chip>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">
                        By {playlist.owner}
                      </p>
                    </div>
                </CardBody>

                <CardFooter className="px-4 pb-4 pt-0 flex justify-between items-center text-small text-default-500">
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-zinc-800 text-zinc-400 h-6 px-1"
                  >
                    {playlist.tracks_total} Tracks
                  </Chip>
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    isIconOnly
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onPress={() => promptDelete(playlist.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>

        {/* Create Playlist Modal */}
        <Modal 
            isOpen={isOpen} 
            onOpenChange={onOpenChange}
            backdrop="blur"
            classNames={{
                base: "bg-zinc-900 border border-white/10 text-white",
                header: "border-b border-white/10",
                footer: "border-t border-white/10",
                closeButton: "hover:bg-white/10 active:bg-white/20",
            }}
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">Create New Playlist</ModalHeader>
                        <ModalBody className="py-6">
                            <Input
                                autoFocus
                                label="Name"
                                placeholder="My Awesome Playlist"
                                variant="bordered"
                                value={newPlaylistName}
                                onValueChange={setNewPlaylistName}
                                classNames={{
                                    inputWrapper: "border-white/20 data-[hover=true]:border-white/40 group-data-[focus=true]:border-primary",
                                }}
                            />
                            <Textarea
                                label="Description"
                                placeholder="Give your playlist a catchy description..."
                                variant="bordered"
                                value={newPlaylistDesc}
                                onValueChange={setNewPlaylistDesc}
                                classNames={{
                                    inputWrapper: "border-white/20 data-[hover=true]:border-white/40 group-data-[focus=true]:border-primary",
                                }}
                            />
                            <div className="flex justify-between items-center px-1">
                                <span className="text-sm text-zinc-400">Public Playlist</span>
                                <Switch 
                                    isSelected={isPublic} 
                                    onValueChange={setIsPublic}
                                    size="sm"
                                    color="success"
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onClose}>
                                Cancel
                            </Button>
                            <Button 
                                color="success" 
                                onPress={() => handleCreatePlaylist(onClose)}
                                isLoading={creating}
                                isDisabled={!newPlaylistName.trim()}
                            >
                                Create
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal 
            isOpen={isDeleteOpen} 
            onOpenChange={onDeleteOpenChange}
            backdrop="blur"
            classNames={{
                base: "bg-zinc-900 border border-white/10 text-white",
                header: "border-b border-white/10",
                footer: "border-t border-white/10",
                closeButton: "hover:bg-white/10 active:bg-white/20",
            }}
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">Confirm Deletion</ModalHeader>
                        <ModalBody className="py-6">
                            <p className="text-zinc-300">
                                Are you sure you want to delete this playlist? This action cannot be undone.
                            </p>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose} className="text-white hover:bg-white/10">
                                Cancel
                            </Button>
                            <Button 
                                color="danger" 
                                onPress={() => confirmDelete(onClose)}
                                isLoading={deleting}
                            >
                                Delete
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
      </main>
    </div>
  );
}
