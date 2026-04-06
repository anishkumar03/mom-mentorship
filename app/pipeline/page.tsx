"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CHANNELS } from "../../lib/constants";
import { usePrograms } from "../../lib/usePrograms";

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
  source: string | null;
  student_id?: string | null;

  program: string | null;
  status: string | null;

  follow_up_at: string | null;
  last_note?: string | null;
  last_contacted_at?: string | null;

  archived?: boolean | null;
  created_at?: string | null;
};

// Programs now fetched dynamically via usePrograms hook
const STAGES = ["New", "Contacted", "Nurture", "Follow Up", "Confirmed", "Lost"] as const;

const STAGE_COLORS: Record<string, { header: string; border: string; count: string }> = {
  "New": { header: "#3b82f6", border: "rgba(59,130,246,0.25)", count: "rgba(59,130,246,0.2)" },
  "Contacted": { header: "#8b5cf6", border: "rgba(139,92,246,0.25)", count: "rgba(139,92,246,0.2)" },
  "Nurture": { header: "#f59e0b", border: "rgba(245,158,11,0.25)", count: "rgba(245,158,11,0.2)" },
  "Follow Up": { header: "#ec4899", border: "rgba(236,72,153,0.25)", count: "rgba(236,72,153,0.2)" },
  "Confirmed": { header: "#22c55e", border: "rgba(34,197,94,0.25)", count: "rgba(34,197,94,0.2)" },
  "Lost": { header: "#ef4444", border: "rgba(239,68,68,0.25)", count: "rgba(239,68,68,0.2)" },
};

const CHANNEL_ICONS: Record<string, string> = {
  "Instagram": "IG", "Facebook": "FB", "Twitter/X": "X", "WhatsApp": "WA",
  "TikTok": "TT", "YouTube": "YT", "LinkedIn": "LI", "Referral": "RF",
  "Website": "WB", "Email": "EM", "Phone Call": "PH", "Walk-in": "WI",
};

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
  const { programs } = usePrograms();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [program, setProgram] = useState<string>("__ALL__");
  const [loading, setLoading] = useState(true);
  const [leadColumns, setLeadColumns] = useState<string[]>([]);
  const [fetchedUnarchivedCount, setFetchedUnarchivedCount] = useState(0);
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
        email: email || "",
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <button
          onClick={() => downloadICS(`MOM_FollowUp_${fileSafe}.ics`, r.ics)}
          style={btnSmall}
        >
          Calendar
        </button>
        <a href={r.googleUrl} target="_blank" rel="noreferrer" style={linkBtnSmall}>
          Google
        </a>
      </div>
    );
  };

  const card = (l: Lead) => {
    const name = leadName(l);
    const followMs = l.follow_up_at ? new Date(l.follow_up_at).getTime() : NaN;
    const isOverdue = Number.isFinite(followMs) && followMs < Date.now();
    const src = l.source || "";
    const channelAbbr = CHANNEL_ICONS[src] || "";

    return (
      <div key={l.id} style={{
        ...cardStyle,
        borderColor: isOverdue ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)",
        background: isOverdue ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.03)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
          {channelAbbr && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 6px",
              borderRadius: 999, background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)", flexShrink: 0,
            }}>
              {channelAbbr}
            </span>
          )}
        </div>

        {/* Last note */}
        {l.last_note && (
          <div style={{
            marginTop: 6, fontSize: 11, opacity: 0.9,
            padding: "4px 8px", borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            borderLeft: "2px solid rgba(255,255,255,0.12)",
          }}>
            {truncatePreview(l.last_note, 80)}
          </div>
        )}

        {/* Contact info */}
        {l.last_contacted_at && (
          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>
            Contacted {timeAgo(l.last_contacted_at)}
          </div>
        )}
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
          {l.program ?? "—"}
        </div>
        <div style={{ fontSize: 11, opacity: 0.65 }}>
          {l.handle ? `@${l.handle}` : ""}{l.email ? ` | ${l.email}` : ""}{l.phone ? ` | ${l.phone}` : ""}
        </div>

        {l.follow_up_at && (
          <div style={{
            marginTop: 6, fontSize: 11, fontWeight: 600,
            color: isOverdue ? "#fca5a5" : "#fcd34d",
          }}>
            {isOverdue ? "OVERDUE: " : "Follow-up: "}
            {new Date(l.follow_up_at).toLocaleString()}
          </div>
        )}

        {l.notes && !l.last_note && (
          <div
            title={l.notes}
            style={{
              marginTop: 4, fontSize: 11, opacity: 0.85,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {l.notes}
          </div>
        )}

        {followButtons(l)}

        {/* Actions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
          <button onClick={() => openNote(l)} style={btnSecondary}>Note</button>
          <button onClick={() => setStatusOnly(l, "Contacted")} style={btnSecondary}>Contacted</button>
          <button onClick={() => openFollow(l)} style={btnPrimary}>Follow</button>
          <button onClick={() => setStatusOnly(l, "Nurture")} style={btnSecondary}>Nurture</button>
          <button onClick={() => setStatusOnly(l, "Confirmed")} style={{
            ...btnSecondary,
            background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)",
          }}>Confirmed</button>
          <button onClick={() => convertToStudent(l)} style={btnSecondary} disabled={!!l.student_id}>
            {l.student_id ? "Converted" : "Student"}
          </button>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Pipeline</h2>
          <div style={{ opacity: 0.6, marginTop: 4, fontSize: 13 }}>
            Board view. All leads live in the Leads master list.
          </div>
        </div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          {loading ? "Loading..." : `${leads.length} leads`}
        </div>
      </div>

      <div style={{ ...panel, marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ opacity: 0.7, fontSize: 13 }}>Program</span>
        <select value={program} onChange={(e) => setProgram(e.target.value)} style={inputSmall}>
          <option value="__ALL__">All</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ marginLeft: "auto", opacity: 0.6, fontSize: 12 }}>
          {fetchedUnarchivedCount} total | {leads.length} showing
        </div>
      </div>

      <div style={board}>
        {STAGES.map((stage) => {
          const stageColor = STAGE_COLORS[stage];
          const stageLeads = byStage[stage] ?? [];
          return (
            <div key={stage} style={{
              ...col,
              borderColor: stageColor.border,
            }}>
              {/* Column header */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 12, paddingBottom: 10,
                borderBottom: `2px solid ${stageColor.header}`,
              }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{stage}</span>
                <span style={{
                  padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: stageColor.count, color: "rgba(255,255,255,0.85)",
                }}>
                  {stageLeads.length}
                </span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {stageLeads.map(card)}
              </div>
              {stageLeads.length === 0 && (
                <div style={{ textAlign: "center", padding: 20, opacity: 0.3, fontSize: 12 }}>
                  No leads
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Follow-up Modal */}
      {followOpen && (
        <div style={modalOverlay} onClick={() => setFollowOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
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

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setFollowOpen(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveFollow} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteOpen && (
        <div style={modalOverlay} onClick={closeNoteModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
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

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
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
  maxWidth: 1400,
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

const board: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 12
};

const col: React.CSSProperties = {
  padding: 12,
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
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.3)",
  color: "white",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
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
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid rgba(31,79,255,0.4)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 11,
};

const btnDanger: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.15)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 11,
};

const btnSmall: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid rgba(31,79,255,0.3)",
  background: "rgba(31,79,255,0.15)",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 600,
};

const linkBtnSmall: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.7)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 10,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalCard: React.CSSProperties = {
  width: 400,
  maxWidth: "100%",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#0b1b33",
};
