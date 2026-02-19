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
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;

  program: string | null;
  status: string | null;

  follow_up_at: string | null;

  archived?: boolean | null;
  created_at?: string | null;
};

const PROGRAMS = ["April Group Mentorship", "General Lead"] as const;
const STAGES = ["New", "Contacted", "Follow Up", "Confirmed", "Lost"] as const;

function stageKey(s: any) {
  const v = (s ?? "New").toString().trim().toLowerCase().replace(/\s+/g, "");
  if (v.startsWith("follow")) return "Follow Up";
  if (v === "new") return "New";
  if (v === "contacted") return "Contacted";
  if (v === "confirmed") return "Confirmed";
  if (v === "lost") return "Lost";
  return "New";
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [program, setProgram] = useState<string>("__ALL__");
  const [loading, setLoading] = useState(true);

  // Follow-up modal
  const [followOpen, setFollowOpen] = useState(false);
  const [followLead, setFollowLead] = useState<Lead | null>(null);
  const [followDate, setFollowDate] = useState("");

  const fetchAll = async () => {
    setLoading(true);

    let q = supabase
      .from("leads")
      .select("*")
      .or("archived.is.null,archived.eq.false")
      .order("created_at", { ascending: false });

    if (program !== "__ALL__") {
      q = q.eq("program", program);
    }

    const { data, error } = await q;

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("archived") || msg.includes("column")) {
        let fallback = supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });
        if (program !== "__ALL__") {
          fallback = fallback.eq("program", program);
        }
        const fallbackRes = await fallback;
        if (fallbackRes.error) {
          console.error(fallbackRes.error);
          setLeads([]);
        } else {
          setLeads(Array.isArray(fallbackRes.data) ? (fallbackRes.data as any) : []);
        }
      } else {
        console.error(error);
        setLeads([]);
      }
    } else {
      setLeads(Array.isArray(data) ? (data as any) : []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [program]);

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of STAGES) map[s] = [];
    for (const l of leads) {
      const key = stageKey(l.status);
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    return map;
  }, [leads]);

  const setStatusOnly = async (l: Lead, newStatus: string) => {
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", l.id);
    if (error) alert(error.message);
    else fetchAll();
  };

  const openFollow = (l: Lead) => {
    const def = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    def.setSeconds(0, 0);

    setFollowLead(l);
    setFollowDate(l.follow_up_at ? toLocalInputValue(l.follow_up_at) : toLocalInputValue(def.toISOString()));
    setFollowOpen(true);
  };

  const saveFollow = async () => {
    if (!followLead) return;
    if (!followDate) {
      alert("Pick a follow-up date/time");
      return;
    }

    const iso = new Date(followDate).toISOString();

    const { error } = await supabase
      .from("leads")
      .update({ status: "Follow Up", follow_up_at: iso })
      .eq("id", followLead.id);

    if (error) {
      alert(error.message);
      return;
    }

    setFollowOpen(false);
    setFollowLead(null);
    setFollowDate("");
    fetchAll();
  };

  const archiveLead = async (l: Lead) => {
    const ok = confirm(`Archive ${l.full_name ?? l.name ?? "this lead"}?`);
    if (!ok) return;

    const { error } = await supabase.from("leads").update({ archived: true }).eq("id", l.id);
    if (error) alert(error.message);
    else fetchAll();
  };

  const card = (l: Lead) => {
    const name = l.full_name ?? l.name ?? "(no name)";
    return (
      <div key={l.id} style={cardStyle}>
        <div style={{ fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {l.program ?? "—"} • {stageKey(l.status)}
        </div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {l.handle ? `@${l.handle}` : ""}{l.email ? ` • ${l.email}` : ""}{l.phone ? ` • ${l.phone}` : ""}
        </div>

        {l.follow_up_at ? (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
            Follow-up: {new Date(l.follow_up_at).toLocaleString()}
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <button onClick={() => setStatusOnly(l, "Contacted")} style={btnSecondary}>Contacted</button>
          <button onClick={() => openFollow(l)} style={btnPrimary}>Follow</button>
          <button onClick={() => setStatusOnly(l, "Confirmed")} style={btnSecondary}>Confirmed</button>
          <button onClick={() => setStatusOnly(l, "Lost")} style={btnDanger}>Lost</button>
          <button onClick={() => archiveLead(l)} style={btnSecondary}>Archive</button>
        </div>
      </div>
    );
  };

  return (
    <div style={page}>
      <h2 style={{ margin: 0 }}>Pipeline</h2>
      <div style={{ opacity: 0.85, marginTop: 6 }}>
        Board view only. All leads still live in the Leads master list.
      </div>

      <div style={{ ...panel, marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ opacity: 0.85 }}>Program</span>
        <select value={program} onChange={(e) => setProgram(e.target.value)} style={inputSmall}>
          <option value="__ALL__">All</option>
          {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ marginLeft: "auto", opacity: 0.85 }}>
          {loading ? "Loading..." : `${leads.length} leads`}
        </div>
      </div>

      <div style={board}>
        {STAGES.map((stage) => (
          <div key={stage} style={col}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>{stage}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {(byStage[stage] ?? []).map(card)}
            </div>
          </div>
        ))}
      </div>

      {followOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Set Follow-up</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              {(followLead?.full_name ?? followLead?.name) ?? ""}
            </div>

            <input
              type="datetime-local"
              value={followDate}
              onChange={(e) => setFollowDate(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setFollowOpen(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveFollow} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1200,
  margin: "20px auto",
  padding: 12,
  color: "white",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  background: "linear-gradient(180deg, #071427 0%, #061122 100%)",
  minHeight: "100vh"
};

const panel: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)"
};

const board: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 12
};

const col: React.CSSProperties = {
  padding: 10,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  minHeight: 300
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.03)"
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.25)",
  color: "white"
};

const inputSmall: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.25)",
  color: "white"
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer"
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer"
};

const btnDanger: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#ff3b30",
  color: "white",
  cursor: "pointer"
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999
};

const modalCard: React.CSSProperties = {
  width: 360,
  borderRadius: 14,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#0b1b33"
};

