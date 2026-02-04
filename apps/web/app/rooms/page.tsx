"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LogOut, ArrowRight, Hash, Globe } from "lucide-react";

export default function RoomsPage() {
  const [room, setRoom] = useState("");
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (!token) router.push("/login");
  }, [router]);

  const joinRoom = () => {
    if (!room.trim()) return;
    router.push(`/chat/${room}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white font-[family-name:var(--font-geist-sans)] selection:bg-white selection:text-black">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-bold tracking-tight text-lg">SignalFlow</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-[family-name:var(--font-geist-mono)] text-neutral-500 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-wide"
        >
          Disconnect <LogOut className="w-3 h-3" />
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-screen p-4 relative overflow-hidden">
        {/* Ambient Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
              Enter the flow.
            </h1>
            <p className="text-neutral-400 text-lg">
              Join a private frequency or broadcast to the world.
            </p>
          </div>

          <div className="space-y-4">
            {/* Room Input Card */}
            <div className="group bg-neutral-900/50 border border-white/10 hover:border-white/20 p-1 rounded-xl transition-all duration-300">
              <div className="relative flex items-center">
                <Hash className="absolute left-4 w-4 h-4 text-neutral-500" />
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                  placeholder="channel-name"
                  className="w-full bg-transparent text-white placeholder-neutral-600 px-10 py-4 outline-none font-[family-name:var(--font-geist-mono)] text-sm"
                />
                <button
                  onClick={joinRoom}
                  disabled={!room.trim()}
                  className="absolute right-2 bg-white text-black hover:bg-neutral-200 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-neutral-600 font-[family-name:var(--font-geist-mono)] uppercase tracking-wider py-2">
              <div className="h-px bg-white/10 flex-1" />
              <span>OR</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            {/* Global Chat Button */}
            <button
              onClick={() => router.push("/chat/global")}
              className="w-full group bg-transparent border border-white/10 hover:border-white/30 text-neutral-300 hover:text-white p-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-3"
            >
              <div className="p-1.5 bg-white/5 rounded-md group-hover:bg-white/10 transition-colors">
                <Globe className="w-4 h-4" />
              </div>
              <span className="font-medium">Enter Global Frequency</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer Status */}
      <footer className="fixed bottom-6 w-full text-center">
        
      </footer>
    </div>
  );
}
