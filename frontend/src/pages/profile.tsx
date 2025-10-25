import { Navbar } from "@/components/navbar";
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
    setError(null);
    setUser(null);

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/me", { redirect: "manual" });

        if (
          res.type === "opaqueredirect" ||
          (res.status >= 300 && res.status < 400)
        ) {
          navigate("/login", { replace: true });
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Failed to fetch: ${res.statusText}`
          );
        }

        const data = await res.json();
        setUser(data.user || null);
      } catch (err: any) {
        setError(err.message || "An unknown error occurred");
      } finally {
        if (location.pathname !== "/login") {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      navigate("/", { replace: true });
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-16 text-white/80">
          Loading your profile...
        </div>
      );
    }

    if (error) {
      return (
        <div
          className="bg-red-900 border border-red-700 text-red-100 px-4 py-4 rounded relative text-center"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="text-center py-16 text-white/80">
          No profile data found.
        </div>
      );
    }

    const avatar = user.images?.[0]?.url || "/vite.svg";

    return (
      <>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-gradient-to-r from-violet-600 to-indigo-600 p-6 md:p-8 rounded-lg shadow-lg text-white">
          <img
            src={avatar}
            alt={user.display_name || user.id}
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover shadow-2xl border-4 border-white/20"
          />
          <div className="text-center sm:text-left">
            <h1 className="text-3xl md:text-4xl font-bold">
              {user.display_name || user.id}
            </h1>
            {user.email && (
              <div className="text-lg text-white/80 mt-1">{user.email}</div>
            )}
            <div className="mt-4 flex flex-wrap gap-3 justify-center sm:justify-start">
              {user.external_url && (
                <a
                  href={user.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 rounded-full bg-white text-violet-600 text-sm font-semibold shadow-sm hover:bg-gray-100 transition"
                >
                  View on Spotify
                </a>
              )}
              <button
                onClick={() => navigate("/playlists")}
                className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium hover:bg-white/30 transition"
              >
                Your Playlists
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-card p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Settings</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Not {user.display_name || "you"}? Log out to switch accounts.
          </p>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium shadow-sm hover:bg-red-700 transition"
          >
            Log Out
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 w-full">
        {renderContent()}
      </div>
    </div>
  );
}
