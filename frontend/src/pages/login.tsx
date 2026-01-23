import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // This logic runs immediately when the page loads
    const backend = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
    window.location.href = `${backend}/api/spotify/auth/login`;
  }, []);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center animate-pulse">
          <h1 className="text-2xl font-bold mb-2">Logging in...</h1>
          <p className="text-zinc-500">Please wait a moment.</p>
        </div>
      </div>
    </>
  );
}
