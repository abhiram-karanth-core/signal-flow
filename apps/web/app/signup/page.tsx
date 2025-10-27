"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("http://localhost:8080/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const err = await res.text();
      alert(err);
      return;
    }

    const data = await res.json();
    alert(data.message || "Signup successful");
    router.push("/login");
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#0f172a",
      color: "#fff"
    }}>
      <div style={{
        padding: "2rem",
        background: "#1e293b",
        borderRadius: "1rem",
        width: "350px",
        boxShadow: "0 0 15px rgba(0,0,0,0.2)"
      }}>
        <h2 style={{ textAlign: "center" }}>Sign Up</h2>
        <form onSubmit={handleSubmit} style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginTop: "1rem"
        }}>
          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            style={{ padding: "0.5rem", borderRadius: "8px", border: "none" }}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ padding: "0.5rem", borderRadius: "8px", border: "none" }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ padding: "0.5rem", borderRadius: "8px", border: "none" }}
            required
          />
          <button
            type="submit"
            style={{
              padding: "0.7rem",
              background: "#3b82f6",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Sign Up
          </button>
        </form>
        <p
          style={{
            marginTop: "1rem",
            textAlign: "center",
            cursor: "pointer",
            color: "#93c5fd"
          }}
          onClick={() => router.push("/login")}
        >
          Already have an account? Log in
        </p>
      </div>
    </div>
  );
}
