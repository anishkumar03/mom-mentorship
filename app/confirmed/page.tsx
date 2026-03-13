"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { PROGRAMS } from "../../lib/constants";

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
  program: string | null;
  status: string | null;
  batch: string | null;
  archived?: boolean | null;
  created_at?: string | null;
};

function safeName(l: Lead) {
  return (l.full_name ?? l.name ?? "").trim() || "(no name)";
}

function downloadCSV(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

export default function ConfirmedPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<string>("__ALL__");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .or("archived.is.null,archived.eq.false")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLeads([]);
    } else {
      setLeads(Array.isArray(data) ? (data as Lead[]) : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const confirmed = useMemo(() => {
    return leads
      .filter((l) => {
        const v = (l.status ?? "").toString().trim().toLowerCase().replace(/\s+/g, "");
        return v === "confirmed";
      })
      .filter((l) => program === "__ALL__" || (l.program ?? "") === program)
      .filter((l) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const searchable = [l.full_name, l.name, l.email, l.handle, l.phone, l.notes, l.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
  }, [leads, program, searchQuery]);

  const programCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of confirmed) {
      const p = l.program || "Unassigned";
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [confirmed]);

  const exportConfirmed = () => {
    const header = ["Name", "Program", "Email", "Phone", "Instagram", "Source", "Notes", "Created At"];
    const body = confirmed.map((l) => [
      safeName(l),
      l.program ?? "",
      l.email ?? "",
      l.phone ?? "",
      l.handle ? `@${l.handle}` : "",
      l.source ?? "",
      l.notes ?? "",
      l.created_at ? new Date(l.created_at).toLocaleString() : "",
    ]);
    downloadCSV(`MOM_Confirmed_${program === "__ALL__" ? "ALL" : program}.csv`, [header, ...body]);
  };

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Confirmed Leads</h2>
          <div style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>
            Leads with confirmed status, ready for onboarding
          </div>
        </div>
        <button onClick={exportConfirmed} style={btnPrimary}>
          Export CSV
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ ...grid3, marginTop: 16 }}>
        <div style={statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#86efac" }}>{confirmed.length}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Total Confirmed</div>
        </div>
        {Object.entries(programCounts).map(([prog, count]) => (
          <div key={prog} style={statCard}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{count}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{prog}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search confirmed leads..."
            style={{ ...inputSmall, minWidth: 180, flex: "1 1 180px" }}
          />
          <select value={program} onChange={(e) => setProgram(e.target.value)} style={inputSmall}>
            <option value="__ALL__">All Programs</option>
            {PROGRAMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 13 }}>
            {loading ? "Loading..." : `${confirmed.length} confirmed`}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {loading && confirmed.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>Loading...</div>
        )}
        {!loading && confirmed.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
            No confirmed leads found. {leads.length > 0 ? "Try adjusting your filters." : ""}
          </div>
        )}
        {confirmed.map((l) => (
          <div key={l.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{safeName(l)}</span>
                  <span style={confirmedBadge}>Confirmed</span>
                  {l.batch && <span style={batchBadgeStyle}>{l.batch}</span>}
                  {l.source && <span style={channelBadge}>{l.source}</span>}
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

                {l.created_at && (
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
                    Added {timeAgo(l.created_at)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
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
  border: "1px solid rgba(34,197,94,0.15)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(34,197,94,0.03)",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const confirmedBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.15)",
  color: "#86efac",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
};

const batchBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(79,163,255,0.15)",
  color: "#93c5fd",
  fontSize: 11,
  fontWeight: 700,
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
  borderLeft: "3px solid rgba(34,197,94,0.3)",
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

const btnPrimary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(31,79,255,0.4)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
