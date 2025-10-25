import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: string;
  display_name?: string;
  email?: string;
  images?: { url: string }[];
  external_url?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    fetch("/api/me", { redirect: "manual" })
      .then(async (res) => {
        if (
          res.type === "opaqueredirect" ||
          (res.status >= 300 && res.status < 400)
        ) {
          navigate("/login", { replace: true });
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch profile");
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setUser(data.user || null);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading)
    return <div className="text-center mt-10">Loading profile...</div>;
  if (error)
    return <div className="text-center mt-10 text-red-500">{error}</div>;
  if (!user) return <div className="text-center mt-10">No profile data.</div>;

  const avatar = user.images?.[0]?.url || "/vite.svg";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-6 bg-card p-6 rounded-lg shadow">
        <img
          src={avatar}
          alt={user.display_name || user.id}
          className="w-28 h-28 rounded-full object-cover shadow-sm"
        />
        <div>
          <h1 className="text-2xl font-bold">{user.display_name || user.id}</h1>
          {user.email && (
            <div className="text-sm text-muted-foreground mt-1">
              {user.email}
            </div>
          )}
          <div className="mt-3 flex gap-3">
            {user.external_url && (
              <a
                href={user.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-full bg-violet-600 text-white text-sm font-medium shadow-sm hover:bg-violet-700 transition"
              >
                View on Spotify
              </a>
            )}
            <button
              onClick={() => window.location.assign("/playlists")}
              className="inline-flex items-center px-3 py-1 rounded-full border text-sm"
            >
              Your Playlists
            </button>
          </div>
        </div>
      </div>

      {/* Extra details */}
      <div className="mt-8 bg-card p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-3">Account details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Spotify ID</dt>
            <dd>{user.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Display name</dt>
            <dd>{user.display_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
