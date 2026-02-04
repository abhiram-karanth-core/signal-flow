"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("https://global-chat-app-hnqw.onrender.com/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Signup failed");
      }

      toast.success("Account created successfully");
      router.push("/login");
    } catch (err) {
      toast.error("Signup failed. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-[family-name:var(--font-geist-sans)]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative bg-[#09090b] p-16 overflow-hidden border-r border-white/10">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block px-3 py-1 mb-6 text-xs font-medium tracking-wider text-purple-400 uppercase border border-purple-400/20 rounded-full font-[family-name:var(--font-geist-mono)]">
              Join the Network
            </div>
            <h1 className="text-6xl font-bold tracking-tighter text-white mb-6">
              Start your<br />Frequency.
            </h1>
            <p className="text-xl text-neutral-400 max-w-md leading-relaxed">
              Create an account to access communication channels instantly.
            </p>
          </motion.div>
        </div>

      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-black relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm z-10"
        >
          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-white mb-2">Create Account</h2>
            <p className="text-neutral-500 text-sm">Enter your details to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide font-[family-name:var(--font-geist-mono)]">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-md focus:ring-1 focus:ring-white focus:border-white outline-none transition-all text-white placeholder-neutral-600 text-sm"
                placeholder="display_name"
                required
              />
            </div>

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
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide font-[family-name:var(--font-geist-mono)]">Password</label>
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
                  Create Account <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-neutral-500">
            Already have an account?{" "}
            <span
              onClick={() => router.push("/login")}
              className="text-white hover:underline cursor-pointer transition-colors"
            >
              Sign in
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
