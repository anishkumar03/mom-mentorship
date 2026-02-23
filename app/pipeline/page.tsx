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
  last_note?: string | null;
  last_contacted_at?: string | null;

  archived?: boolean | null;
  created_at?: string | null;
};

const PROGRAMS = ["April Group Mentorship", "General Lead"] as const;
const STAGES = ["New", "Contacted", "Nurture", "Follow Up", "Confirmed", "Lost"] as const;

function stageKey(s: any) {
  const v = (s ?? "New").toString().trim().toLowerCase().replace(/\s+/g, "");
  if (v.startsWith("follow")) return "Follow Up";
  if (v === "nurture" || v === "waiting" || v === "pending") return "Nurture";
  if (v === "new") return "New";
  if (v === "contacted") return "Contacted";
  if (v === "confirmed") return "Confirmed";
  if (v === "lost") return "Lost";
  return "New";
}

function leadName(l: Lead) {
  const full = (l.full_name ?? "").toString().trim();
  if (full) return full;
  const name = (l.name ?? "").toString().trim();
  return name || "(no name)";
}

function maskSupabaseUrl(raw?: string) {
  if (!raw) return "(missing)";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.split("/")[0] || raw;
  }
}

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncatePreview(text: string, max = 100) {
  const v = text.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1).trimEnd()}…`;
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [program, setProgram] = useState<string>("__ALL__");
  const [loading, setLoading] = useState(true);
  const [leadColumns, setLeadColumns] = useState<string[]>([]);
  const [debugCount, setDebugCount] = useState<number | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  const debugVisible =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1");

  // Follow-up modal
  const [followOpen, setFollowOpen] = useState(false);
  const [followLead, setFollowLead] = useState<Lead | null>(null);
  const [followDate, setFollowDate] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteContactedAt, setNoteContactedAt] = useState("");

  const fetchAll = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLeads([]);
      setLeadColumns([]);
      setLoading(false);
      return;
    }

    const rows = Array.isArray(data) ? (data as any) : [];
    const cols = rows.length ? Object.keys(rows[0] ?? {}) : [];
    setLeadColumns(cols);

    const hasArchived = cols.includes("archived");
    const base = hasArchived ? rows.filter((l: any) => !l.archived) : rows;
    const hasProgram = cols.includes("program");
    const filtered = hasProgram && program !== "__ALL__" ? base.filter((l: any) => (l.program ?? "") === program) : base;
    setLeads(filtered);

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [program]);

  useEffect(() => {
    if (!debugVisible) return;
    let mounted = true;
    (async () => {
      const { count, error } = await supabase.from("leads").select("*", { count: "exact", head: true });
      if (!mounted) return;
      if (error) {
        setDebugError(error.message);
        setDebugCount(null);
      } else {
        setDebugError(null);
        setDebugCount(typeof count === "number" ? count : null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [debugVisible]);

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
    if (stageKey(newStatus) === "Follow Up") {
      openFollow(l);
      return;
    }
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

  const openNote = (l: Lead) => {
    setNoteLead(l);
    setNoteText((l.last_note ?? "") as string);
    setNoteContactedAt(
      l.last_contacted_at ? toLocalInputValue(l.last_contacted_at) : toLocalInputValue(new Date().toISOString())
    );
    setNoteOpen(true);
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

  const closeNoteModal = () => {
    setNoteOpen(false);
    setNoteLead(null);
    setNoteText("");
    setNoteContactedAt("");
  };

  const saveNote = async () => {
    if (!noteLead) return;

    const contactedISO = noteContactedAt ? new Date(noteContactedAt).toISOString() : null;
    if (noteContactedAt && Number.isNaN(new Date(noteContactedAt).getTime())) {
      alert("Pick a valid last contacted date/time");
      return;
    }

    const { error } = await supabase
      .from("leads")
      .update({
        last_note: noteText.trim() ? noteText.trim() : null,
        last_contacted_at: contactedISO
      })
      .eq("id", noteLead.id);

    if (error) {
      alert(error.message);
      return;
    }

    closeNoteModal();
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
    const name = leadName(l);
    return (
        <div key={l.id} style={cardStyle}>
        <div style={{ fontWeight: 700 }}>{name}</div>
        {l.last_note ? (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.92 }}>
            Last note: {truncatePreview(l.last_note, 100)}
          </div>
        ) : null}
        {l.last_contacted_at ? (
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
            Last contacted: {new Date(l.last_contacted_at).toLocaleString()}
          </div>
        ) : null}
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
          <button onClick={() => openNote(l)} style={btnSecondary}>Add Note</button>
          <button onClick={() => setStatusOnly(l, "Contacted")} style={btnSecondary}>Contacted</button>
          <button onClick={() => openFollow(l)} style={btnPrimary}>Follow</button>
          <button onClick={() => setStatusOnly(l, "Nurture")} style={btnSecondary}>Nurture</button>
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
      {debugVisible && (
        <div style={{ ...panel, marginTop: 12, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Supabase URL: {maskSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Anon key present: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Yes" : "No"}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Leads count: {debugError ? `Error: ${debugError}` : debugCount ?? "—"}
          </div>
        </div>
      )}

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

      {noteOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Add Note</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              {(noteLead?.full_name ?? noteLead?.name) ?? ""}
            </div>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What did they say?"
              style={{ ...input, minHeight: 110, marginTop: 12, resize: "vertical" }}
            />

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Last contacted (optional)</div>
              <input
                type="datetime-local"
                value={noteContactedAt}
                onChange={(e) => setNoteContactedAt(e.target.value)}
                style={input}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={closeNoteModal} style={btnSecondary}>Cancel</button>
              <button onClick={saveNote} style={btnPrimary}>Save</button>
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

