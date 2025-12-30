import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { Navbar } from "@/components/navbar";

export default function LoginPage() {
  const handleLogin = () => {
    // Use the backend URL in development, otherwise use relative path for production
    const backend = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
    window.location.href = `${backend}/api/auth/login`;
  };

  return (
    <>
      <Navbar></Navbar>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-600/85 via-teal-600/75 to-slate-700/85 px-8">
        <div className="w-full max-w-2xl p-20 rounded-3xl shadow-2xl bg-emerald-800/50 backdrop-blur-md border border-emerald-700/35">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-6">
              Connect Your Account
            </h1>
            <p className="text-base sm:text-lg text-white/80 max-w-prose mx-auto mb-10">
              Sign into Spotify to view personalized content!
            </p>

            <Button
              onClick={handleLogin}
              className="mx-auto bg-[#1DB954] text-black px-10 py-4 rounded-full text-xl font-medium shadow-lg hover:brightness-95"
            >
              Login to Spotify
            </Button>

            <div className="mt-6">
              <Link href="/" className="text-base text-white/90 underline">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
