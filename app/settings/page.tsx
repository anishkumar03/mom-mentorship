"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Program = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export default function SettingsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchPrograms = async () => {
    const { data } = await supabase
      .from("programs")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setPrograms(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const addProgram = async () => {
    const name = newName.trim();
    if (!name) return;
    setError("");
    setSuccess("");
    setSaving(true);

    // Check duplicate
    if (programs.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setError("Program already exists");
      setSaving(false);
      return;
    }

    const { error: err } = await supabase.from("programs").insert({ name });
    if (err) {
      setError(err.message);
    } else {
      setSuccess(`"${name}" added`);
      setNewName("");
      await fetchPrograms();
    }
    setSaving(false);
  };

  const toggleActive = async (p: Program) => {
    await supabase.from("programs").update({ active: !p.active }).eq("id", p.id);
    await fetchPrograms();
  };

  const deleteProgram = async (p: Program) => {
    if (!confirm(`Delete "${p.name}"? This won't affect existing leads/students.`)) return;
    await supabase.from("programs").delete().eq("id", p.id);
    await fetchPrograms();
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (p: Program) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const oldProgram = programs.find((p) => p.id === editingId);
    const oldName = oldProgram?.name;
    const newNameTrimmed = editName.trim();

    await supabase.from("programs").update({ name: newNameTrimmed }).eq("id", editingId);

    // Also update existing leads and students that use the old name
    if (oldName && oldName !== newNameTrimmed) {
      await supabase.from("leads").update({ program: newNameTrimmed }).eq("program", oldName);
      await supabase.from("students").update({ program: newNameTrimmed }).eq("program", oldName);
    }

    setEditingId(null);
    setEditName("");
    await fetchPrograms();
  };

  return (
    <div style={{ padding: "24px 16px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "white" }}>
        Settings
      </h1>

      {/* Programs Section */}
      <div style={{
        background: "var(--card)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        padding: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "white" }}>
          Programs
        </h2>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#f87171",
            fontSize: 13,
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#4ade80",
            fontSize: 13,
            marginBottom: 12,
          }}>
            {success}
          </div>
        )}

        {/* Add new program */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New program name..."
            onKeyDown={(e) => e.key === "Enter" && addProgram()}
            style={{
              flex: 1,
              background: "var(--input-bg, rgba(255,255,255,0.06))",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "white",
              fontSize: 14,
            }}
          />
          <button
            onClick={addProgram}
            disabled={saving || !newName.trim()}
            style={{
              background: "var(--accent, #3b82f6)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              opacity: saving || !newName.trim() ? 0.5 : 1,
            }}
          >
            Add
          </button>
        </div>

        {/* Programs list */}
        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading...</p>
        ) : programs.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No programs yet. Add one above.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {programs.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                {editingId === p.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      style={{
                        flex: 1,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: "white",
                        fontSize: 14,
                      }}
                    />
                    <button
                      onClick={saveEdit}
                      style={{
                        background: "#22c55e",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        background: "transparent",
                        color: "var(--muted)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{
                      flex: 1,
                      color: p.active ? "white" : "var(--muted)",
                      fontSize: 14,
                      textDecoration: p.active ? "none" : "line-through",
                    }}>
                      {p.name}
                    </span>

                    <button
                      onClick={() => toggleActive(p)}
                      title={p.active ? "Deactivate" : "Activate"}
                      style={{
                        background: p.active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        color: p.active ? "#4ade80" : "#f87171",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </button>

                    <button
                      onClick={() => startEdit(p)}
                      style={{
                        background: "rgba(59,130,246,0.15)",
                        color: "#60a5fa",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteProgram(p)}
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        color: "#f87171",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
