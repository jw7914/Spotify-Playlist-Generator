import { Link } from "@heroui/link";
import { Navbar } from "@/components/navbar";

export default function IndexPage() {
  return (
    <div className="relative flex flex-col h-screen bg-black">
      {" "}
      <Navbar></Navbar>
      <main className="flex flex-col items-center w-full px-6">
        <section className="w-full max-w-6xl mt-12">
          <div className="relative overflow-hidden rounded-[48px] bg-gradient-to-r from-green-400 via-teal-400 to-indigo-500 p-16 md:p-28 shadow-2xl">
            {/* subtle dark overlay to match the design */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] rounded-[48px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center justify-center text-center text-white">
              <h1 className="max-w-3xl text-4xl md:text-6xl font-extrabold leading-tight">
                Your music. Your mood. Your content.
              </h1>

              <p className="mt-6 max-w-2xl text-base md:text-lg text-white/90">
                Connect your account to generate personalized AI content
                inspired by your music!
              </p>

              <div className="mt-10">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-full shadow-lg transition"
                >
                  <span className="font-medium">Login to Spotify</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
