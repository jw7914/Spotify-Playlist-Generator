import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Navbar } from "@/components/navbar";
import { Music, Sparkles, MessageCircleHeart, ArrowRight } from "lucide-react";

export default function IndexPage() {
  return (
    <div className="relative min-h-screen bg-black text-foreground overflow-hidden selection:bg-green-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-green-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <Navbar />

      <main className="relative z-10 flex flex-col items-center w-full px-6 pt-10 md:pt-20">
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center max-w-4xl space-y-8">
          {/* Badge */}
          <Chip
            variant="flat"
            color="success"
            startContent={<Sparkles size={14} />}
            className="bg-green-500/10 text-green-400 border border-green-500/20"
          >
            AI-Powered Curation
          </Chip>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            Turn your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
              vibe
            </span>{" "}
            <br />
            into a playlist.
          </h1>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl">
            Connect your Spotify. Chat with our AI. Generate distinct playlists
            tailored to your exact mood, nostalgia, or aesthetic.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto mt-4">
            <Button
              size="lg"
              className="bg-[#1DB954] text-black font-semibold hover:bg-[#1ed760] transition-all shadow-[0_0_20px_rgba(29,185,84,0.3)]"
              endContent={<ArrowRight size={18} />}
            >
              Connect Spotify
            </Button>
          </div>
        </section>

        {/* Visual Showcase (Mock Chat UI) */}
        <section className="w-full max-w-5xl mt-20 mb-20">
          <div className="relative w-full p-1 rounded-3xl bg-gradient-to-b from-zinc-800 to-black">
            <div className="relative bg-zinc-950 rounded-[22px] overflow-hidden border border-zinc-800 shadow-2xl">
              {/* Window Controls */}
              <div className="h-12 border-b border-zinc-800 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                <div className="w-3 h-3 rounded-full bg-green-500/20" />
              </div>

              {/* Chat Simulation Area */}
              <div className="p-8 md:p-12 flex flex-col gap-6 h-[400px] md:h-[500px] relative">
                {/* AI Message */}
                <div className="flex gap-4 max-w-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-2xl rounded-tl-none border border-zinc-800 text-zinc-300">
                    <p>
                      Welcome back! I see you've been listening to a lot of 80s
                      City Pop lately. What kind of playlist should we build
                      today?
                    </p>
                  </div>
                </div>

                {/* User Message */}
                <div className="flex gap-4 max-w-lg self-end flex-row-reverse">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-full bg-zinc-700 animate-pulse" />
                  </div>
                  <div className="bg-[#1DB954]/10 p-4 rounded-2xl rounded-tr-none border border-[#1DB954]/20 text-green-100">
                    <p>
                      I need something for a late-night drive. Moody,
                      synth-heavy, but with high energy.
                    </p>
                  </div>
                </div>

                {/* AI Response (Playlist Generation) */}
                <div className="flex gap-4 max-w-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="bg-zinc-900 p-4 rounded-2xl rounded-tl-none border border-zinc-800 text-zinc-300">
                      <p>
                        Generating "Midnight Velocity" based on your request...
                      </p>
                    </div>

                    {/* Mock Playlist Card */}
                    <Card className="bg-black/40 border border-white/10 backdrop-blur-md w-64">
                      <CardHeader className="flex gap-3">
                        <div className="w-12 h-12 rounded bg-gradient-to-br from-pink-500 to-orange-400" />
                        <div className="flex flex-col">
                          <p className="text-md font-bold text-white">
                            Midnight Velocity
                          </p>
                          <p className="text-small text-zinc-500">
                            24 Songs • 1h 12m
                          </p>
                        </div>
                      </CardHeader>
                      <CardBody className="py-2">
                        <Button
                          size="sm"
                          className="w-full bg-[#1DB954] text-black font-medium"
                        >
                          Save to Spotify
                        </Button>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Bottom Fade */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mb-24">
          {[
            {
              title: "Deep Analysis",
              icon: Music,
              desc: "We scan your recent top tracks and genres to understand your current taste profile.",
            },
            {
              title: "Natural Chat",
              icon: MessageCircleHeart,
              desc: "Describe what you want in plain English. 'Songs that sound like purple rain' actually works.",
            },
            {
              title: "Instant Sync",
              icon: Sparkles,
              desc: "One click exports your new curated mix directly to your Spotify library.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-900 transition-colors"
            >
              <feature.icon className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-zinc-400">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
