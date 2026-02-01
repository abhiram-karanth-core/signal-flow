"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { WebSocketProvider, useWebSocket } from "../../../context/SocketProvider"
import styles from "../../page.module.css"

function ChatRoom() {
  const { messages, sendMessage, isConnected } = useWebSocket()
  const [message, setMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { roomId } = useParams<{ roomId: string }>()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !isConnected) return
    sendMessage(message)
    setMessage("")
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    window.location.href = "/login"
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>
            {roomId === 'global' ? 'Global Chat' : `Room: ${roomId}`}
          </h1>
          <div className={styles.headerRight}>
            <div className={styles.connectionStatus}>
              <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`}></span>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <button className={styles.logoutButton} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Messages Area */}
      <main className={styles.main}>
        <div className={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💬</div>
              <h3>No messages yet</h3>
              <p>Start the conversation by sending a message below</p>
            </div>
          ) : (
            <div className={styles.messagesList}>
              {messages.map((msg, i) => (
                <div key={i} className={styles.messageBubble}>
                  <div className={styles.messageMeta}>
                    <span className={styles.username}>{msg.username}</span>
                    <span className={styles.timestamp}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={styles.messageContent}>{msg.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Footer Input */}
      <footer className={styles.footer}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <div className={styles.inputContainer}>
            <textarea
              className={styles.chatInput}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={!isConnected}
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              rows={1}
            />
            <div className={styles.inputActions}>
              <span className={styles.charCount}>{message.length}/500</span>
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!isConnected || !message.trim()}
              >
                ➤
              </button>
            </div>
          </div>
        </form>
      </footer>
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
