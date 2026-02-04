"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/rooms");
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black text-white">
      <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
    </div>
  );
}
