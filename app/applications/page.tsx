"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Application {
  id: string;
  created_at: string;
  full_name: string;
  experience: string;
  challenge: string;
  challenge_detail?: string;
  email?: string;
  phone?: string;
  status: string;
  source?: string;
  notes?: string;
}

const STATUSES = ["all", "new", "contacted", "qualified", "enrolled", "not_a_fit"] as const;

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  new:       { bg: "#1a2f1a", border: "#4caf50", text: "#81c784", label: "New" },
  contacted: { bg: "#1a2540", border: "#4c7fc9", text: "#82b1ff", label: "Contacted" },
  qualified: { bg: "#2a1f10", border: "#c9a84c", text: "#f0d080", label: "Qualified" },
  enrolled:  { bg: "#1f1040", border: "#9c6dff", text: "#ce93d8", label: "Enrolled" },
  not_a_fit: { bg: "#2a1212", border: "#c94c4c", text: "#ef9a9a", label: "Not a Fit" },
};

const EXPERIENCE_LABELS: Record<string, string> = {
  less_1:  "< 1 year",
  "1_3":   "1–3 years",
  "3_5":   "3–5 years",
  "5_plus":"5+ years",
};

function formatDate(ts: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-CA", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.new;
  return (
    <span style={{
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 500,
      background: st.bg,
      border: `1px solid ${st.border}`,
      color: st.text,
      whiteSpace: "nowrap" as const,
    }}>
      {st.label}
    </span>
  );
}

function Stat({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" as const }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: gold ? "#C9A84C" : "#E8E0CE" }}>{value}</span>
      <span style={{ fontSize: 11, color: "rgba(232,224,206,0.5)", fontWeight: 300 }}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" as const, padding: "6px 0", borderBottom: "1px solid rgba(201,168,76,0.08)" }}>
      <span style={{ fontSize: 12, color: "rgba(232,224,206,0.5)", fontWeight: 300 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#E8E0CE", fontWeight: 400, textAlign: "right" as const, maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchApps(); }, []);

  async function fetchApps() {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    setApps((data as Application[]) || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("applications").update({ status }).eq("id", id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("applications").update({ notes }).eq("id", selected.id);
    setApps(prev => prev.map(a => a.id === selected.id ? { ...a, notes } : a));
    setSaving(false);
  }

  function openDetail(app: Application) {
    setSelected(app);
    setNotes(app.notes || "");
  }

  const filtered = apps.filter(a => {
    const matchStatus = filter === "all" || a.status === filter;
    const matchSearch = !search ||
      a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase()) ||
      a.challenge?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === "all" ? apps.length : apps.filter(a => a.status === s).length;
    return acc;
  }, {});

  const NAVY = "#0A1628";
  const NAVY_MID = "#0E1E38";
  const GOLD = "#C9A84C";
  const GOLD_BORDER = "rgba(201,168,76,0.2)";
  const TEXT = "#E8E0CE";
  const MUTED = "rgba(232,224,206,0.5)";

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", background: NAVY, color: TEXT, fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between" as const, alignItems: "flex-start" as const, marginBottom: "1.5rem", flexWrap: "wrap" as const, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: TEXT, margin: 0 }}>Applications</h1>
          <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0", fontWeight: 300 }}>Mentorship applications from your apply page</p>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <Stat label="Total" value={apps.length} />
          <Stat label="New" value={counts.new || 0} gold />
          <Stat label="Qualified" value={counts.qualified || 0} />
          <Stat label="Enrolled" value={counts.enrolled || 0} />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: "1.25rem", gap: 12, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
          {STATUSES.map(st => (
            <button key={st} onClick={() => setFilter(st)} style={{
              padding: "6px 14px", borderRadius: 20,
              border: `1px solid ${filter === st ? GOLD : GOLD_BORDER}`,
              background: filter === st ? "rgba(201,168,76,0.1)" : "transparent",
              color: filter === st ? GOLD : MUTED,
              fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center" as const, gap: 6,
              fontFamily: "Inter, sans-serif",
            }}>
              {st === "all" ? "All" : STATUS_STYLES[st]?.label}
              <span style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 7px", fontSize: 10 }}>{counts[st] || 0}</span>
            </button>
          ))}
        </div>
        <input
          style={{ padding: "8px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, background: NAVY_MID, color: TEXT, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", width: 240 }}
          placeholder="Search name, email, challenge..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" as const }}>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {loading ? (
            <div style={{ color: MUTED, fontSize: 14, padding: "2rem", textAlign: "center" as const }}>Loading applications...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 14, padding: "2rem", textAlign: "center" as const }}>No applications found.</div>
          ) : filtered.map(app => (
            <div key={app.id} onClick={() => openDetail(app)} style={{
              background: NAVY_MID,
              border: `1px solid ${selected?.id === app.id ? GOLD : GOLD_BORDER}`,
              borderRadius: 12, padding: "1rem 1.25rem", cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center" as const, gap: 10, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: `1px solid ${GOLD_BORDER}`, color: GOLD, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0 }}>
                  {app.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{app.full_name}</span>
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 300 }}>{EXPERIENCE_LABELS[app.experience] || app.experience}</span>
                </div>
                <StatusBadge status={app.status} />
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 8, fontWeight: 300 }}>{app.challenge}</div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" as const, flexWrap: "wrap" as const }}>
                {app.email && <span style={{ fontSize: 11, color: MUTED, fontWeight: 300 }}>✉ {app.email}</span>}
                {app.phone && <span style={{ fontSize: 11, color: MUTED, fontWeight: 300 }}>📱 {app.phone}</span>}
                <span style={{ fontSize: 11, color: "rgba(232,224,206,0.3)", marginLeft: "auto" }}>{formatDate(app.created_at)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected ? (
          <div style={{ background: NAVY_MID, border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: "1.5rem", position: "sticky" as const, top: 20 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" as const, marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: `1px solid ${GOLD_BORDER}` }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: `1px solid ${GOLD}`, color: GOLD, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center" as const, justifyContent: "center" as const }}>
                {selected.full_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: TEXT, margin: 0 }}>{selected.full_name}</h2>
                <p style={{ fontSize: 11, color: MUTED, margin: "3px 0 0", fontWeight: 300 }}>{formatDate(selected.created_at)}</p>
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: 8 }}>Status</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(STATUS_STYLES).map(([key, val]) => (
                  <button key={key} onClick={() => updateStatus(selected.id, key)} style={{
                    padding: "7px 10px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    background: selected.status === key ? val.bg : "transparent",
                    border: `1px solid ${selected.status === key ? val.border : "rgba(201,168,76,0.15)"}`,
                    color: selected.status === key ? val.text : "rgba(232,224,206,0.4)",
                  }}>{val.label}</button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: 8 }}>Details</label>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
                <InfoRow label="Experience" value={EXPERIENCE_LABELS[selected.experience] || selected.experience} />
                <InfoRow label="Challenge" value={selected.challenge} />
                <InfoRow label="Email" value={selected.email || "—"} />
                <InfoRow label="Phone" value={selected.phone || "—"} />
              </div>
            </div>

            {/* Story */}
            {selected.challenge_detail && (
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: 8 }}>Their Story</label>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, fontWeight: 300, background: "rgba(255,255,255,0.02)", padding: "10px 12px", borderRadius: 8, border: `1px solid ${GOLD_BORDER}`, margin: 0 }}>{selected.challenge_detail}</p>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: 8 }}>Your Notes</label>
              <textarea
                style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: "10px 12px", color: TEXT, fontSize: 13, fontFamily: "Inter, sans-serif", fontWeight: 300, resize: "vertical" as const, outline: "none", boxSizing: "border-box" as const }}
                rows={4}
                placeholder="Add private notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <button onClick={saveNotes} disabled={saving} style={{ marginTop: 8, padding: "8px 18px", background: GOLD, color: NAVY, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                {saving ? "Saving..." : "Save Notes"}
              </button>
            </div>

            {/* Actions */}
            <div>
              <label style={{ fontSize: 11, color: GOLD, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: 8 }}>Quick Actions</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                {selected.email && (
                  <a href={`mailto:${selected.email}`} style={{ padding: "8px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, textDecoration: "none" }}>✉ Email</a>
                )}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} style={{ padding: "8px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, textDecoration: "none" }}>📱 Call</a>
                )}
                {selected.phone && (
                  <a href={`https://wa.me/${selected.phone?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ padding: "8px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, textDecoration: "none" }}>💬 WhatsApp</a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: NAVY_MID, border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: "3rem", display: "flex", alignItems: "center" as const, justifyContent: "center" as const }}>
            <p style={{ color: "rgba(232,224,206,0.3)", fontSize: 14, margin: 0 }}>Select an application to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
