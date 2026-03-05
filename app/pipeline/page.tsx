"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  student_id?: string | null;

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toICSDateUTC(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function googleCalendarTemplateUrl(params: {
  title: string;
  details?: string;
  startISO: string;
  endISO: string;
}) {
  const start = new Date(params.startISO);
  const end = new Date(params.endISO);

  const fmt = (d: Date) =>
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z";

  const dates = `${fmt(start)}/${fmt(end)}`;
  const sp = new URLSearchParams();
  sp.set("action", "TEMPLATE");
  sp.set("text", params.title);
  sp.set("dates", dates);
  if (params.details) sp.set("details", params.details);
  return `https://calendar.google.com/calendar/render?${sp.toString()}`;
}

function buildReminder(lead: Lead) {
  const name = (lead.full_name ?? lead.name ?? "Lead").trim();
  const whenISO = lead.follow_up_at ?? "";
  const start = new Date(whenISO);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  const title = `Call: ${name} (Mind Over Markets)`;
  const detailsParts = [
    lead.program ? `Program: ${lead.program}` : "",
    lead.phone ? `Phone: ${lead.phone}` : "",
    lead.email ? `Email: ${lead.email}` : "",
    lead.handle ? `IG: @${lead.handle}` : "",
    lead.notes ? `Notes: ${lead.notes}` : ""
  ].filter(Boolean);
  const details = detailsParts.join("\n");

  const uid = `${lead.id}-${Date.now()}@mindovermarkets`;
  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mind Over Markets//Lead Reminder//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${toICSDateUTC(new Date())}
DTSTART:${toICSDateUTC(start)}
DTEND:${toICSDateUTC(end)}
SUMMARY:${title.replace(/\n/g, " ")}
DESCRIPTION:${details.replace(/\n/g, "\\n")}
END:VEVENT
END:VCALENDAR`;

  const googleUrl = googleCalendarTemplateUrl({
    title,
    details,
    startISO: start.toISOString(),
    endISO: end.toISOString()
  });

  return { ics, googleUrl };
}

export default function PipelinePage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [program, setProgram] = useState<string>("__ALL__");
  const [loading, setLoading] = useState(true);
  const [leadColumns, setLeadColumns] = useState<string[]>([]);
  const [fetchedUnarchivedCount, setFetchedUnarchivedCount] = useState(0);
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
  const [contactedHint, setContactedHint] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [disableMarkContacted, setDisableMarkContacted] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<string>("__NONE__");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .is("student_id", null)
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
    if (cols.length && !cols.includes("last_contacted_at")) {
      setDisableMarkContacted(true);
      setContactedHint("Mark contacted needs last_contacted_at column.");
    } else if (cols.length) {
      setDisableMarkContacted(false);
      setContactedHint(null);
    }

    const hasArchived = cols.includes("archived");
    const hasStudentId = cols.includes("student_id");
    const hasConvertedAt = cols.includes("converted_at");
    const base = (hasArchived
      ? rows.filter((l: any) => l.archived === false || l.archived == null)
      : rows)
      .filter((l: any) => (hasStudentId ? !l.student_id : true))
      .filter((l: any) => (hasConvertedAt ? !l.converted_at : true));
    setFetchedUnarchivedCount(base.length);

    const hasProgram = cols.includes("program");
    const filtered =
      hasProgram && program !== "__ALL__"
        ? base.filter((l: any) => (l.program ?? "") === program)
        : base;
    setLeads(filtered);
    setSelectedIds(new Set());

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    router.refresh();
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
    setNoteText(((l.notes ?? l.last_note) ?? "") as string);
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

    const payload: any = {
      notes: noteText.trim() ? noteText.trim() : null,
      last_note: noteText.trim() ? noteText.trim() : null,
      last_contacted_at: contactedISO
    };

    if (disableMarkContacted) {
      delete payload.last_contacted_at;
    }

    const res = await supabase
      .from("leads")
      .update(payload)
      .eq("id", noteLead.id);

    if (res.error) {
      alert(res.error.message);
      return;
    }

    closeNoteModal();
    fetchAll();
  };

  const markContacted = async (l: Lead) => {
    if (disableMarkContacted || markingId) return;
    setMarkingId(l.id);
    const payload: any = {
      status: "Contacted",
      last_contacted_at: new Date().toISOString()
    };
    try {
      const res = await supabase.from("leads").update(payload).eq("id", l.id);
      if (res.error) {
        alert(res.error.message);
      } else {
        fetchAll();
      }
    } finally {
      setMarkingId(null);
    }
  };

  const undoContacted = async (l: Lead) => {
    if (disableMarkContacted || markingId) return;
    setMarkingId(l.id);
    const payload: any = {
      status: "New",
      last_contacted_at: null
    };
    try {
      const res = await supabase.from("leads").update(payload).eq("id", l.id);
      if (res.error) {
        alert(res.error.message);
      } else {
        fetchAll();
      }
    } finally {
      setMarkingId(null);
    }
  };

  const archiveLead = async (l: Lead) => {
    const ok = confirm(`Archive ${l.full_name ?? l.name ?? "this lead"}?`);
    if (!ok) return;

    const { error } = await supabase.from("leads").update({ archived: true }).eq("id", l.id);
    if (error) alert(error.message);
    else fetchAll();
  };

  const convertToStudent = async (l: Lead) => {
    if (l.student_id) return;
    setConvertError(null);

    const email = (l.email ?? "").trim();
    if (email) {
      const existing = await supabase
        .from("students")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing.data?.id) {
        alert("A student already exists with this email.");
        return;
      }
    }

    const safeName =
      (l.full_name ?? "").trim() ||
      (l.name ?? "").trim() ||
      email ||
      "Unnamed";
    const safeFullName = (l.full_name ?? l.name ?? "").trim() || null;

    const inserted = await supabase
      .from("students")
      .insert({
        name: safeName,
        full_name: safeFullName,
        email: email || null,
        phone: l.phone ?? null,
        program: l.program ?? "General Lead"
      })
      .select("id")
      .single();

    if (inserted.error) {
      setConvertError(inserted.error.message);
      return;
    }

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", l.id);

    if (error) {
      setConvertError(error.message);
      return;
    }

    setLeads((prev) => prev.filter((lead) => lead.id !== l.id));
    fetchAll();
    router.refresh();
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(leads.map((l) => l.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const bulkUpdate = async (payload: Record<string, any>) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const { error } = await supabase
      .from("leads")
      .update(payload)
      .in("id", ids);
    if (error) {
      alert(error.message);
      return;
    }
    await fetchAll();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const ok = confirm(`Delete ${ids.length} lead(s)? This cannot be undone.`);
    if (!ok) return;
    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", ids);
    if (error) {
      alert(error.message);
      return;
    }
    await fetchAll();
  };

  const runBulkMarkContacted = async () => {
    const payload: any = { status: "Contacted" };
    if (leadColumns.includes("last_contacted_at")) {
      payload.last_contacted_at = new Date().toISOString();
    }
    await bulkUpdate(payload);
  };

  const runBulkArchive = async () => {
    if (leadColumns.includes("archived")) {
      await bulkUpdate({ archived: true });
      return;
    }
    await bulkUpdate({ status: "Archived" });
  };

  const runBulkMoveStage = async (nextStage: string) => {
    await bulkUpdate({ status: nextStage });
  };

  const followButtons = (l: Lead) => {
    const followMs = l.follow_up_at ? new Date(l.follow_up_at).getTime() : NaN;
    const isFuture = Number.isFinite(followMs) && followMs > Date.now();
    if (!isFuture) return null;

    const r = buildReminder(l);
    const fileSafe = leadName(l).replace(/[^a-z0-9]+/gi, "_");
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => downloadICS(`MOM_FollowUp_${fileSafe}.ics`, r.ics)}
          style={btnPrimary}
        >
          Add to Calendar (ICS)
        </button>
        <a href={r.googleUrl} target="_blank" rel="noreferrer" style={linkBtn}>
          Google Calendar
        </a>
      </div>
    );
  };

  const card = (l: Lead) => {
    const name = leadName(l);
    const followMs = l.follow_up_at ? new Date(l.follow_up_at).getTime() : NaN;
    const isFuture = Number.isFinite(followMs) && followMs > Date.now();
    const stage = stageKey(l.status);
    const primaryAction =
      stage === "Confirmed" ? "convert" : stage === "Follow Up" ? "follow" : "confirm";
    return (
        <div
          key={l.id}
          style={{
            ...cardStyle,
            ...(hoveredId === l.id ? cardHoverStyle : null)
          }}
          onMouseEnter={() => setHoveredId(l.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
        <div style={{ fontWeight: 700 }}>{name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <input
            type="checkbox"
            checked={selectedIds.has(l.id)}
            onChange={() => toggleSelected(l.id)}
            style={{ width: 16, height: 16 }}
          />
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {l.program ?? "—"} • {stageKey(l.status)}
          </div>
        </div>
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
          {l.handle ? `@${l.handle}` : ""}{l.email ? ` • ${l.email}` : ""}{l.phone ? ` • ${l.phone}` : ""}
        </div>

        {l.follow_up_at ? (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
            Follow-up: {new Date(l.follow_up_at).toLocaleString()}
          </div>
        ) : null}
        {l.follow_up_at && !isFuture ? (
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85, color: "#fca5a5" }}>
            Overdue
          </div>
        ) : null}
        {l.notes ? (
          <div
            title={l.notes}
            style={{
              marginTop: 4,
              fontSize: 12,
              opacity: 0.9,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            Notes: {l.notes}
          </div>
        ) : null}
        {followButtons(l)}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <button onClick={() => openNote(l)} style={btnSecondary}>Add Note</button>
          <button
            onClick={() => markContacted(l)}
            style={{
              ...btnSecondary,
              opacity: disableMarkContacted || stageKey(l.status) === "Contacted" || markingId === l.id ? 0.6 : 1
            }}
            disabled={disableMarkContacted || stageKey(l.status) === "Contacted" || markingId === l.id}
          >
            {markingId === l.id ? "Marking..." : "Mark Contacted"}
          </button>
          <button
            onClick={() => undoContacted(l)}
            style={{
              ...btnSecondary,
              opacity: disableMarkContacted || stageKey(l.status) !== "Contacted" || markingId === l.id ? 0.5 : 1
            }}
            disabled={disableMarkContacted || stageKey(l.status) !== "Contacted" || markingId === l.id}
            title={stageKey(l.status) !== "Contacted" ? "Only for contacted leads" : undefined}
          >
            Undo Contacted
          </button>
          <div style={{ width: "100%" }} />
          <button onClick={() => openFollow(l)} style={primaryAction === "follow" ? btnPrimary : btnSecondary}>Follow</button>
          <button onClick={() => setStatusOnly(l, "Nurture")} style={btnSecondary}>Nurture</button>
          <button onClick={() => setStatusOnly(l, "Confirmed")} style={primaryAction === "confirm" ? btnPrimary : btnSecondary}>Confirm</button>
          <button onClick={() => convertToStudent(l)} style={primaryAction === "convert" ? btnPrimary : btnSecondary} disabled={!!l.student_id}>
            Convert to Student
          </button>
          {l.student_id ? (
            <span
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid rgba(46, 204, 113, 0.5)",
                color: "#b6f2cf",
                fontSize: 11,
                fontWeight: 700
              }}
            >
              Converted
            </span>
          ) : null}
          <button onClick={() => setStatusOnly(l, "Lost")} style={btnDanger}>Lost</button>
          <button onClick={() => archiveLead(l)} style={btnSecondary}>Archive</button>
        </div>
        {disableMarkContacted && contactedHint ? (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {contactedHint}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div style={page}>
      <h2 style={{ margin: 0 }}>Pipeline</h2>
      <div style={{ opacity: 0.85, marginTop: 6 }}>
        Board view only. All leads still live in the Leads master list.
      </div>
      {convertError ? (
        <div style={{ ...panel, marginTop: 12, background: "rgba(255,0,0,0.08)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Convert to student failed</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{convertError}</div>
        </div>
      ) : null}
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={selectAllVisible} style={btnSecondarySmall}>Select all</button>
          <button onClick={clearSelection} style={btnSecondarySmall}>Clear</button>
        </div>
        <div style={{ marginLeft: "auto", opacity: 0.85 }}>
          {loading ? "Loading..." : `${leads.length} leads`}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ ...panel, marginTop: 12, padding: 10, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>{selectedIds.size} selected</div>
            <button onClick={runBulkMarkContacted} style={btnSecondarySmall}>Mark contacted</button>
            <button onClick={() => runBulkMoveStage("Lost")} style={btnDangerSmall}>Move to Lost</button>
            <button onClick={runBulkArchive} style={btnSecondarySmall}>Archive</button>
            <button onClick={bulkDelete} style={btnDangerSmall}>Delete</button>
            <select
              value={bulkStage}
              onChange={(e) => {
                const next = e.target.value;
                setBulkStage(next);
                if (next !== "__NONE__") runBulkMoveStage(next);
              }}
              style={inputSmall}
            >
              <option value="__NONE__">Move to stage…</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
        Fetched {fetchedUnarchivedCount} leads (unarchived). Showing {leads.length} after filters.
      </div>

      <div style={board}>
        {STAGES.map((stage) => (
          <div key={stage} style={col}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>{stage}</div>
              <span style={stageCountBadge}>{(byStage[stage] ?? []).length}</span>
            </div>
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

const stageCountBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontSize: 11,
  fontWeight: 700
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.03)",
  transition: "transform 120ms ease, box-shadow 120ms ease",
  boxShadow: "0 0 0 rgba(0,0,0,0)"
};

const cardHoverStyle: React.CSSProperties = {
  transform: "translateY(-2px)",
  boxShadow: "0 12px 24px rgba(0,0,0,0.18)"
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
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  fontSize: 12
};

const btnSecondary: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 12
};

const btnDanger: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#ff3b30",
  color: "white",
  cursor: "pointer",
  fontSize: 12
};

const btnSecondarySmall: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600
};

const btnDangerSmall: React.CSSProperties = {
  ...btnSecondarySmall,
  background: "#ff3b30"
};

const linkBtn: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
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


