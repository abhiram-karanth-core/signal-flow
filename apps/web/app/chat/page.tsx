"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function ChatIndexPage() {
  const router = useRouter()
  const [room, setRoom] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) router.push("/login")
  }, [router])

  const joinRoom = () => {
    if (!room.trim()) return
    router.push(`/chat/${room}`)
  }

  return (
    <div>
      <h1>Join a chat room</h1>
      <input
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder="Room name"
      />
      <button onClick={joinRoom}>Join</button>
    </div>
  )
}
