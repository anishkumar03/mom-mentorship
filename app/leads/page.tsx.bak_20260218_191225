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

  program: string | null;
  status: string | null;

  call_scheduled_at: string | null;
  follow_up_at: string | null;

  archived?: boolean | null;
  created_at?: string | null;
};

const PROGRAMS = ["April Group Mentorship", "General Lead"] as const;
const STATUSES = ["New", "Contacted", "Follow Up", "Confirmed", "Lost"] as const;

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const [programFilter, setProgramFilter] = useState<string>("__ALL__");
  const [statusFilter, setStatusFilter] = useState<string>("__ALL__");

  // Form state (Add / Edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [source, setSource] = useState("Instagram");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [program, setProgram] = useState<string>("April Group Mentorship");
  const [status, setStatus] = useState<string>("New");

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

    const { data, error } = await q;

    if (error) {
      console.error(error);
      setLeads([]);
    } else {
      setLeads(Array.isArray(data) ? (data as any) : []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (programFilter !== "__ALL__" && (l.program ?? "") !== programFilter) return false;
      if (statusFilter !== "__ALL__" && stageKey(l.status) !== statusFilter) return false;
      return true;
    });
  }, [leads, programFilter, statusFilter]);

  const resetForm = () => {
    setEditingId(null);
    setFullName("");
    setSource("Instagram");
    setHandle("");
    setPhone("");
    setEmail("");
    setNotes("");
    setProgram("April Group Mentorship");
    setStatus("New");
  };

  const loadEdit = (l: Lead) => {
    setEditingId(l.id);
    setFullName((l.full_name ?? l.name ?? "") as string);
    setSource(l.source ?? "Instagram");
    setHandle(l.handle ?? "");
    setPhone(l.phone ?? "");
    setEmail(l.email ?? "");
    setNotes(l.notes ?? "");
    setProgram(l.program ?? "April Group Mentorship");
    setStatus(stageKey(l.status));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveLead = async () => {
    const payload: any = {
      full_name: fullName.trim() ? fullName.trim() : null,
      source: source || null,
      handle: handle.trim() ? handle.trim() : null,
      phone: phone.trim() ? phone.trim() : null,
      email: email.trim() ? email.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      program: program || null,
      status: status,
      archived: false
    };

    if (!payload.full_name) {
      alert("Name is required");
      return;
    }

    let res;
    if (editingId) {
      res = await supabase.from("leads").update(payload).eq("id", editingId);
    } else {
      res = await supabase.from("leads").insert(payload);
    }

    if (res.error) {
      alert(res.error.message);
      return;
    }

    resetForm();
    fetchAll();
  };

  const setStatusOnly = async (l: Lead, newStatus: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", l.id);

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

  const deleteLead = async (l: Lead) => {
    const ok = confirm(`DELETE ${l.full_name ?? l.name ?? "this lead"}? This cannot be undone.`);
    if (!ok) return;

    const { error } = await supabase.from("leads").delete().eq("id", l.id);
    if (error) alert(error.message);
    else fetchAll();
  };

  const card = (l: Lead) => {
    const name = l.full_name ?? l.name ?? "(no name)";
    return (
      <div key={l.id} style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{name}</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              {l.program ?? "—"} • {stageKey(l.status)}
            </div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              {l.handle ? `@${l.handle}` : ""}{l.email ? ` • ${l.email}` : ""}{l.phone ? ` • ${l.phone}` : ""}
            </div>
            {l.follow_up_at ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                Follow-up: {new Date(l.follow_up_at).toLocaleString()}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => loadEdit(l)} style={btnSecondary}>Edit</button>
            <button onClick={() => setStatusOnly(l, "Contacted")} style={btnSecondary}>Contacted</button>
            <button onClick={() => openFollow(l)} style={btnPrimary}>Follow</button>
            <button onClick={() => setStatusOnly(l, "Confirmed")} style={btnSecondary}>Confirmed</button>
            <button onClick={() => setStatusOnly(l, "Lost")} style={btnDanger}>Lost</button>
            <button onClick={() => archiveLead(l)} style={btnSecondary}>Archive</button>
            <button onClick={() => deleteLead(l)} style={btnDanger}>Delete</button>
          </div>
        </div>

        {l.notes ? (
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
            {l.notes}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div style={page}>
      <h2 style={{ margin: 0 }}>Leads (Master List)</h2>
      <div style={{ opacity: 0.85, marginTop: 6 }}>
        This page always shows all unarchived leads, regardless of pipeline status.
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? "Edit Lead" : "Add Lead"}</h3>

        <div style={grid2}>
          <div>
            <label style={label}>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Program</label>
            <select value={program} onChange={(e) => setProgram(e.target.value)} style={input}>
              {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label style={label}>Source</label>
            <input value={source} onChange={(e) => setSource(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={label}>Instagram handle (without @)</label>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} style={input} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={saveLead} style={btnPrimary}>{editingId ? "Update Lead" : "Add Lead"}</button>
          <button onClick={resetForm} style={btnSecondary}>Clear</button>
        </div>
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.85 }}>Program</span>
            <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} style={inputSmall}>
              <option value="__ALL__">All</option>
              {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.85 }}>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputSmall}>
              <option value="__ALL__">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginLeft: "auto", opacity: 0.85 }}>
            {loading ? "Loading..." : `${filtered.length} leads`}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {filtered.map(card)}
        </div>
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
  maxWidth: 1100,
  margin: "20px auto",
  padding: 16,
  color: "white",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  background: "linear-gradient(180deg, #071427 0%, #061122 100%)",
  minHeight: "100vh"
};

const panel: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)"
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 6
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
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer"
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer"
};

const btnDanger: React.CSSProperties = {
  padding: "10px 12px",
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
