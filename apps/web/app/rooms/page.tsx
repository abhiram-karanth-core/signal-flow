"use client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export default function RoomsPage() {
  const [room, setRoom] = useState("")
  const router = useRouter()

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
      <h1>Join a room</h1>
      <input
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder="room name"
      />
      <button onClick={joinRoom}>Join</button>

      <hr />

      <button onClick={() => router.push("/chat/global")}>
        Join Global
      </button>
    </div>
  )
}
