"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  full_name: string | null;
  name: string | null;
  source: string | null;
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string | null;
  program: string | null;
  follow_up_at: string | null;
  archived: boolean;
  archived_at?: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Confirmed": { bg: "rgba(34,197,94,0.15)", text: "#86efac" },
  "Lost": { bg: "rgba(239,68,68,0.15)", text: "#fca5a5" },
  "Follow Up": { bg: "rgba(236,72,153,0.15)", text: "#f9a8d4" },
  "Contacted": { bg: "rgba(139,92,246,0.15)", text: "#c4b5fd" },
  "New": { bg: "rgba(59,130,246,0.15)", text: "#93c5fd" },
  "Nurture": { bg: "rgba(245,158,11,0.15)", text: "#fcd34d" },
};

function stageKey(s: string | null) {
  const v = (s ?? "New").toString().trim().toLowerCase().replace(/\s+/g, "");
  if (v.startsWith("follow")) return "Follow Up";
  if (v === "nurture" || v === "waiting" || v === "pending") return "Nurture";
  if (v === "new") return "New";
  if (v === "contacted") return "Contacted";
  if (v === "confirmed") return "Confirmed";
  if (v === "lost") return "Lost";
  return "New";
}

function safeName(l: Lead) {
  return (l.full_name ?? l.name ?? "").trim() || "(no name)";
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ArchivePage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__ALL__");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? "";

    if (!email) {
      window.location.href = "/login";
      return;
    }

    if (email !== "anish@mindovermarkets.net") {
      setError("Access denied");
      setLoading(false);
      return;
    }

    const { data: rows, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .eq("archived", true)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setItems((rows as Lead[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((l) => {
      if (statusFilter !== "__ALL__" && stageKey(l.status) !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchable = [l.full_name, l.name, l.email, l.handle, l.phone, l.notes, l.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of items) {
      const s = stageKey(l.status);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const restore = async (lead: Lead) => {
    setRestoringId(lead.id);
    const { error: err } = await supabase
      .from("leads")
      .update({ archived: false, status: "Follow Up" })
      .eq("id", lead.id);

    if (err) {
      alert(err.message);
      setRestoringId(null);
      return;
    }

    setItems((prev) => prev.filter((l) => l.id !== lead.id));
    setRestoringId(null);
  };

  const deletePermanently = async (lead: Lead) => {
    const ok = confirm(`Permanently delete ${safeName(lead)}? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(lead.id);
    const { error: err } = await supabase.from("leads").delete().eq("id", lead.id);

    if (err) {
      alert(err.message);
      setDeletingId(null);
      return;
    }

    setItems((prev) => prev.filter((l) => l.id !== lead.id));
    setDeletingId(null);
  };

  const uniqueStatuses = useMemo(() => {
    const set = new Set(items.map((l) => stageKey(l.status)));
    return Array.from(set).sort();
  }, [items]);

  const StatusBadge = ({ status }: { status: string | null }) => {
    const stage = stageKey(status);
    const colors = STATUS_COLORS[stage] ?? STATUS_COLORS["New"];
    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 999,
          background: colors.bg,
          color: colors.text,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {stage}
      </span>
    );
  };

  return (
    <div style={page}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Archive</h2>
        <div style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>
          Won and Lost leads are stored here so your Leads page stays clean
        </div>
      </div>

      {/* Error / Access denied */}
      {error && (
        <div style={{ ...panel, marginTop: 16, borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}>
          <div style={{ color: "#fca5a5", fontWeight: 600 }}>{error}</div>
        </div>
      )}

      {/* Stats */}
      {!error && (
        <div style={{ ...grid3, marginTop: 16 }}>
          <div style={statCard}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>{items.length}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Total Archived</div>
          </div>
          {Object.entries(statusCounts).map(([status, count]) => {
            const colors = STATUS_COLORS[status] ?? STATUS_COLORS["New"];
            return (
              <div key={status} style={statCard}>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors.text }}>{count}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{status}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {!error && (
        <div style={{ ...panel, marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived leads..."
              style={{ ...inputSmall, minWidth: 180, flex: "1 1 180px" }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputSmall}>
              <option value="__ALL__">All Statuses</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 13 }}>
              {loading ? "Loading..." : `${filtered.length} of ${items.length} archived`}
            </div>
          </div>
        </div>
      )}

      {/* Cards */}
      {!error && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {loading && items.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>Loading...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
              No archived leads found.{items.length > 0 ? " Try adjusting your filters." : ""}
            </div>
          )}
          {filtered.map((l) => (
            <div key={l.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{safeName(l)}</span>
                    <StatusBadge status={l.status} />
                    {l.source && (
                      <span style={channelBadge}>{l.source}</span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    {l.program && <span>{l.program}</span>}
                    {l.handle && <span>@{l.handle}</span>}
                    {l.email && <span>{l.email}</span>}
                    {l.phone && <span>{l.phone}</span>}
                  </div>

                  {l.notes && (
                    <div style={noteBlock}>
                      {l.notes.length > 120 ? `${l.notes.slice(0, 120).trimEnd()}…` : l.notes}
                    </div>
                  )}

                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
                    Created {l.created_at ? timeAgo(l.created_at) : "—"}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => restore(l)}
                    disabled={restoringId === l.id}
                    style={{
                      ...btnRestore,
                      opacity: restoringId === l.id ? 0.5 : 1,
                    }}
                  >
                    {restoringId === l.id ? "Restoring..." : "Restore"}
                  </button>
                  <button
                    onClick={() => deletePermanently(l)}
                    disabled={deletingId === l.id}
                    style={{
                      ...btnDanger,
                      opacity: deletingId === l.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === l.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1100,
  margin: "20px auto",
  padding: 16,
  color: "white",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  background: "linear-gradient(180deg, #071427 0%, #061122 100%)",
  minHeight: "100vh",
};

const panel: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255,255,255,0.03)",
  transition: "border-color 0.2s",
};

const statCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
};

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
};

const channelBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
  fontSize: 11,
  fontWeight: 600,
};

const noteBlock: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  opacity: 0.9,
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  borderLeft: "3px solid rgba(255,255,255,0.15)",
};

const inputSmall: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.3)",
  color: "white",
  fontSize: 13,
  outline: "none",
};

const btnRestore: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 10,
  border: "1px solid rgba(34,197,94,0.3)",
  background: "rgba(34,197,94,0.12)",
  color: "#86efac",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

const btnDanger: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.12)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};
