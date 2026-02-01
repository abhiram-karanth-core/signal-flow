"use client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import styles from "./rooms.module.css"

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
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Join a Room</h1>
        <p className={styles.subtitle}>Connect with others in real-time chat</p>

        <div className={styles.card}>
          <div className={styles.inputContainer}>
            <input
              className={styles.input}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Enter room name"
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
            />
            <button className={styles.joinButton} onClick={joinRoom}>
              Join
            </button>
          </div>

          <div className={styles.divider}>OR</div>

          <button
            className={styles.globalButton}
            onClick={() => router.push("/chat/global")}
          >
            <span className={styles.icon}>🌍</span>
            Join Global Chat
          </button>
        </div>
      </div>
    </div>
  )
}
