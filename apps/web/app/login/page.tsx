"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("https://global-chat-app-hnqw.onrender.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username); // Assuming backend returns username
      toast.success("Welcome back");
      router.push("/rooms");
    } catch (err) {
      toast.error("Login failed. Please check your credentials.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-[family-name:var(--font-geist-sans)]">
      {/* Left Panel - Minimalist Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative bg-[#09090b] p-16 overflow-hidden border-r border-white/10">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl font-bold tracking-tighter text-white mb-6">
              SignalFlow
            </h1>
            <p className="text-xl text-neutral-400 max-w-md leading-relaxed">
              The noise-free communication platform for professionals who value clarity and speed.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="grid grid-cols-2 gap-12 font-[family-name:var(--font-geist-mono)] text-sm text-neutral-500">
            <div>
              <div className="text-white mb-2">Simplicity</div>
              <p>Stripped down to the essentials.</p>
            </div>
            <div>
              <div className="text-white mb-2">Speed</div>
              <p>Engineered for instant response.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-black relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm z-10"
        >
          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-2">Sign in</h2>
            <p className="text-neutral-500 text-sm">Welcome back to SignalFlow.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide font-[family-name:var(--font-geist-mono)]">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-md focus:ring-1 focus:ring-white focus:border-white outline-none transition-all text-white placeholder-neutral-600 text-sm"
                placeholder="name@work.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide font-[family-name:var(--font-geist-mono)]">Password</label>
              </div>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-md focus:ring-1 focus:ring-white focus:border-white outline-none transition-all text-white placeholder-neutral-600 text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white hover:bg-neutral-200 text-black font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed text-sm mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-neutral-500">
            Don't have an account?{" "}
            <span
              onClick={() => router.push("/signup")}
              className="text-white hover:underline cursor-pointer transition-colors"
            >
              Sign up
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
