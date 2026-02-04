"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WebSocketProvider, useWebSocket } from "../../../context/SocketProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Send, LogOut, ArrowLeft, MoreVertical, Hash, Globe, Loader2 } from "lucide-react";

function ChatRoom() {
  const { messages, sendMessage, isConnected } = useWebSocket();
  const [message, setMessage] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [lastSentMessage, setLastSentMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();

  useEffect(() => {
    // Try to recover from previous session
    const stored = localStorage.getItem("username");
    if (stored) {
      setCurrentUsername(stored);
    }
  }, []);

  // Heuristic: If we don't know our username, watch incoming messages.
  // If we see a message that matches what we just sent, that's us!
  useEffect(() => {
    if (!currentUsername && lastSentMessage && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.text === lastSentMessage) {
        // Found ourselves!
        setCurrentUsername(lastMsg.username);
        localStorage.setItem("username", lastMsg.username);
        setLastSentMessage(null); // Reset
      }
    }
  }, [messages, lastSentMessage, currentUsername]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isConnected) return;

    // Store this text to match against incoming messages
    setLastSentMessage(message);

    sendMessage(message);
    setMessage("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  const handleLeaveRoom = () => {
    router.push("/rooms");
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-[family-name:var(--font-geist-sans)] selection:bg-white selection:text-black overflow-hidden">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLeaveRoom}
            className="p-2 -ml-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col">
            <h1 className="flex items-center gap-2 font-bold text-lg tracking-tight">
              {roomId === 'global' ? <Globe className="w-4 h-4 text-neutral-500" /> : <Hash className="w-4 h-4 text-neutral-500" />}
              {roomId === 'global' ? 'Global Frequency' : roomId}
            </h1>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
              <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-[family-name:var(--font-geist-mono)]">
                {isConnected ? 'Signal Stable' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="text-xs font-[family-name:var(--font-geist-mono)] text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-2 uppercase tracking-wide px-3 py-1.5 border border-transparent hover:border-red-400/20 rounded-md"
          >
            Termination <LogOut className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Main Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
        <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col justify-end">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 space-y-4 opacity-50">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                {roomId === 'global' ? <Globe className="w-8 h-8" /> : <Hash className="w-8 h-8" />}
              </div>
              <div className="text-center font-[family-name:var(--font-geist-mono)] text-sm">
                <p>Channel initialized.</p>
                <p>Begin transmission.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col space-y-1 w-full">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  const isMe = msg.username === currentUsername;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
                    >
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <span className={`text-xs font-bold ${isMe ? 'text-green-400' : 'text-neutral-400'}`}>
                          {msg.username}
                        </span>
                        <span className="text-[10px] text-neutral-600 font-[family-name:var(--font-geist-mono)]">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`px-4 py-3 border rounded-2xl text-sm leading-relaxed shadow-sm transition-colors ${isMe
                        ? 'bg-neutral-100 border-neutral-100 text-black rounded-br-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-200 rounded-tl-sm'
                        }`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>
      </main>

      {/* Footer Input */}
      <footer className="flex-none p-4 md:p-6 bg-black z-20">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2 bg-neutral-900/50 border border-neutral-800 focus-within:border-neutral-600 rounded-xl p-2 transition-colors">
            <input
              className="w-full bg-transparent text-white placeholder-neutral-600 px-4 py-3 outline-none max-h-32 min-h-[50px] resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!isConnected}
              placeholder={isConnected ? "Broadcast message..." : "Establishing connection..."}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!isConnected || !message.trim()}
              className="p-3 bg-white text-black rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-none"
            >
              {isConnected ? <Send className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
            </button>
          </div>
          <div className="mt-2 text-center">
            <span className="text-[10px] text-neutral-600 font-[family-name:var(--font-geist-mono)] uppercase tracking-wider">
              {message.length}/500
            </span>
          </div>
        </form>
      </footer>
    </div>
  );
}

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.push("/login");
  }, [router]);

  if (!roomId) return null;

  return (
    <WebSocketProvider roomId={roomId}>
      <ChatRoom />
    </WebSocketProvider>
  );
}
