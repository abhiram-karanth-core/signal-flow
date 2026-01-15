"use client";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";

interface WebSocketProviderProps {
  children?: React.ReactNode;
}

interface IWebSocketContext {
  sendMessage: (msg: string) => void;
  messages: ChatMessage[];
  isConnected: boolean;
}
type ChatMessage = {
  id?: string
  username: string
  text: string
  created_at: string
}

const WebSocketContext = React.createContext<IWebSocketContext | null>(null);

export const useWebSocket = () => {
  const state = useContext(WebSocketContext);
  if (!state) throw new Error(`WebSocket context is undefined`);
  return state;
};

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const connect = useCallback(() => {
    try {
      // Connect to your Go WebSocket server
      const socket = new WebSocket("ws:https://global-chat-app-hnqw.onrender.com/subscribe");

      socket.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ChatMessage;

          setMessages((prev) => [...prev, data]);
        } catch (err) {
          console.error("Invalid WebSocket message:", event.data);
        }
      };


      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);

        // Auto-reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(() => {
          console.log("Attempting to reconnect...");
          connect();
        }, 3000);
      };

      ws.current = socket;
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }, []);

  const sendMessage = useCallback((msg: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("No token found");
      return;
    }

    fetch("https://global-chat-app-hnqw.onrender.com/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, 
      },
      body: JSON.stringify({ text: msg }),
    }).catch((error) => {
      console.error("Failed to send message:", error);
    });
  }, []);


  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ sendMessage, messages, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}