"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CHANNELS } from "../../lib/constants";
import { usePrograms } from "../../lib/usePrograms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function QuickAddPage() {
  const { programs } = usePrograms();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [source, setSource] = useState("Instagram");
  const [program, setProgram] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "duplicate" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (programs.length > 0 && !program) setProgram(programs[0]);
  }, [programs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSaving(true);
    setResult(null);

    // Check for duplicates first
    if (phone || email) {
      let dupQuery = supabase
        .from("leads")
        .select("id, full_name")
        .ilike("full_name", fullName.trim());

      if (phone) dupQuery = dupQuery.eq("phone", phone.trim());
      else if (email) dupQuery = dupQuery.ilike("email", email.trim());

      const { data: existing } = await dupQuery.limit(1);
      if (existing && existing.length > 0) {
        setSaving(false);
        setResult({ type: "duplicate", message: `"${existing[0].full_name}" already exists with this info.` });
        return;
      }
    }

    const payload: Record<string, unknown> = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      handle: handle.trim() || null,
      source: source || "Instagram",
      program,
      notes: notes.trim() || null,
      status: "New",
    };

    const { error } = await supabase.from("leads").insert(payload);

    setSaving(false);

    if (error) {
      setResult({ type: "error", message: error.message });
    } else {
      setResult({ type: "success", message: `${fullName.trim()} added!` });
      // Reset form
      setFullName("");
      setPhone("");
      setEmail("");
      setHandle("");
      setNotes("");
      setSource("Instagram");
      setProgram(programs[0] || "");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 12px",
    fontSize: 16,
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--muted)",
    marginBottom: 4,
    display: "block",
    fontWeight: 500,
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 120px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Quick Add Lead</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Paste info from Instagram DMs
      </p>

      {result && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 500,
            background:
              result.type === "success"
                ? "rgba(34,197,94,0.15)"
                : result.type === "duplicate"
                ? "rgba(245,158,11,0.15)"
                : "rgba(239,68,68,0.15)",
            color:
              result.type === "success"
                ? "#86efac"
                : result.type === "duplicate"
                ? "#fcd34d"
                : "#fca5a5",
          }}
        >
          {result.type === "success" && "✓ "}
          {result.type === "duplicate" && "⚠ "}
          {result.type === "error" && "✕ "}
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Name - required */}
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            required
            autoFocus
            style={inputStyle}
          />
        </div>

        {/* Phone */}
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 123-4567"
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            style={inputStyle}
          />
        </div>

        {/* Instagram Handle */}
        <div>
          <label style={labelStyle}>Instagram Handle</label>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@username"
            style={inputStyle}
          />
        </div>

        {/* Source */}
        <div>
          <label style={labelStyle}>Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{ ...inputStyle, appearance: "auto" }}
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>

        {/* Program */}
        <div>
          <label style={labelStyle}>Program</label>
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            style={{ ...inputStyle, appearance: "auto" }}
          >
            {programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes from the conversation..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || !fullName.trim()}
          style={{
            width: "100%",
            padding: "16px",
            fontSize: 16,
            fontWeight: 700,
            background: saving ? "var(--border)" : "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: saving ? "not-allowed" : "pointer",
            marginTop: 8,
          }}
        >
          {saving ? "Adding..." : "Add Lead"}
        </button>
      </form>
    </div>
  );
}
