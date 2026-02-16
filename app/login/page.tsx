"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("anish@mindovermarkets.net");
  const [msg, setMsg] = useState("");

  const sendLink = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "http://localhost:3000/admin" },
    });

    if (error) setMsg(error.message);
    else setMsg("Magic link sent. Check your email.");
  };

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h2>Mind Over Markets Admin Login</h2>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, marginTop: 12 }}
      />
      <button onClick={sendLink} style={{ width: "100%", padding: 10, marginTop: 12 }}>
        Send magic link
      </button>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
