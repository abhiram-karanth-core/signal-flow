"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {WebSocketProvider, useWebSocket } from "../../../context/SocketProvider"
import styles from "../../page.module.css"

function ChatRoom() {
  const { messages, sendMessage, isConnected } = useWebSocket()
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !isConnected) return
    sendMessage(message)
    setMessage("")
  }

  return (
    <div className={styles.container}>
      {/* YOUR EXISTING CHAT JSX GOES HERE */}
      {/* messages list, input, header, footer — same as before */}
      <div className={styles.messagesList}>
        {messages.map((msg, i) => (
          <div key={i}>{msg.username}: {msg.text}</div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!isConnected}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>()
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) router.push("/login")
  }, [router])

  if (!roomId) return null

  return (
    <WebSocketProvider roomId={roomId}>
      <ChatRoom />
    </WebSocketProvider>
  )
}
