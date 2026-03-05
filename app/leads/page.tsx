"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { PROGRAMS, CHANNELS } from "../../lib/constants";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  full_name: string | null;
  name: string | null;
  source: string | null;
  lead_source?: string | null;
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;

  program: string | null;
  status: string | null;
  student_id?: string | null;

  call_scheduled_at: string | null;
  follow_up_at: string | null;
  last_note?: string | null;
  last_contacted_at?: string | null;

  archived?: boolean | null;
  created_at?: string | null;
};

const STATUSES = ["New", "Contacted", "Nurture", "Follow Up", "Confirmed", "Lost"] as const;
const LEAD_SOURCES = ["Instagram", "WhatsApp", "Referral", "YouTube", "Manual"] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "New": { bg: "rgba(59,130,246,0.15)", text: "#93c5fd" },
  "Contacted": { bg: "rgba(139,92,246,0.15)", text: "#c4b5fd" },
  "Nurture": { bg: "rgba(245,158,11,0.15)", text: "#fcd34d" },
  "Follow Up": { bg: "rgba(236,72,153,0.15)", text: "#f9a8d4" },
  "Confirmed": { bg: "rgba(34,197,94,0.15)", text: "#86efac" },
  "Lost": { bg: "rgba(239,68,68,0.15)", text: "#fca5a5" },
};

const CHANNEL_ICONS: Record<string, string> = {
  "Instagram": "IG",
  "Facebook": "FB",
  "Twitter/X": "X",
  "WhatsApp": "WA",
  "TikTok": "TT",
  "YouTube": "YT",
  "LinkedIn": "LI",
  "Referral": "RF",
  "Website": "WB",
  "Email": "EM",
  "Phone Call": "PH",
  "Walk-in": "WI",
  "Other": "OT",
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

function daysAgoLabel(iso?: string | null) {
  if (!iso) return "Never contacted";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never contacted";
  const now = new Date();
  const startNow = new Date(now);
  startNow.setHours(0, 0, 0, 0);
  const startThen = new Date(d);
  startThen.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startNow.getTime() - startThen.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Last contacted: Today";
  if (diffDays === 1) return "Last contacted: 1 day ago";
  return `Last contacted: ${diffDays} days ago`;
}

function followUpBadge(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const startNow = new Date(now);
  startNow.setHours(0, 0, 0, 0);
  const startTarget = new Date(d);
  startTarget.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startTarget.getTime() - startNow.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { label: `Overdue by ${days} day${days === 1 ? "" : "s"}`, tone: "overdue" as const };
  }
  if (diffDays === 0) {
    return { label: "Due today", tone: "today" as const };
  }
  return { label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`, tone: "future" as const };
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
  const end = new Date(start.getTime() + 15 * 60 * 1000); // 15 minutes

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

  return { title, details, ics, googleUrl, start, end };
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

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadColumns, setLeadColumns] = useState<string[]>([]);
  const [debugCount, setDebugCount] = useState<number | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  const [programFilter, setProgramFilter] = useState<string>("__ALL__");
  const [statusFilter, setStatusFilter] = useState<string>("__ALL__");
  const [sourceFilter, setSourceFilter] = useState<string>("__ALL__");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state (Add / Edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [source, setSource] = useState("Instagram");
  const [leadSource, setLeadSource] = useState("Instagram");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [program, setProgram] = useState<string>("April Group Mentorship");
  const [status, setStatus] = useState<string>("New");
  const [formOpen, setFormOpen] = useState(false);

  // Follow-up modal
  const [followOpen, setFollowOpen] = useState(false);
  const [followLead, setFollowLead] = useState<Lead | null>(null);
  const [followDate, setFollowDate] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteContactedAt, setNoteContactedAt] = useState("");
  const [queryStatus, setQueryStatus] = useState<string | null>(null);
  const [queryFollowup, setQueryFollowup] = useState<string | null>(null);
  const [contactedHint, setContactedHint] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [disableMarkContacted, setDisableMarkContacted] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<string>("__NONE__");

  const debugVisible =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1");

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
    const filtered = (hasArchived ? rows.filter((l: any) => !l.archived) : rows)
      .filter((l: any) => (hasStudentId ? !l.student_id : true))
      .filter((l: any) => (hasConvertedAt ? !l.converted_at : true));
    setLeads(filtered);
    setSelectedIds(new Set());

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const status = sp.get("status");
    const followup = sp.get("followup");
    setQueryStatus(status ? status.toLowerCase() : null);
    setQueryFollowup(followup ? followup.toLowerCase() : null);
  }, []);

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

  const filtered = useMemo(() => {
    const hasProgram = leadColumns.includes("program");
    const hasStatus = leadColumns.includes("status");
    const hasSource = leadColumns.includes("source");
    return leads.filter((l) => {
      if (hasProgram && programFilter !== "__ALL__" && (l.program ?? "") !== programFilter) return false;
      if (hasStatus && statusFilter !== "__ALL__" && stageKey(l.status) !== statusFilter) return false;
      if (hasSource && sourceFilter !== "__ALL__" && (l.source ?? "") !== sourceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          l.full_name, l.name, l.email, l.handle, l.phone, l.notes, l.source
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [leads, programFilter, statusFilter, sourceFilter, searchQuery, leadColumns]);

  const upcomingFollowUps = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const hasArchived = leadColumns.includes("archived");
    const hasStatus = leadColumns.includes("status");
    const hasFollowUp = leadColumns.includes("follow_up_at");
    if (!hasFollowUp) return [];

    return leads
      .filter((l) => (hasArchived ? !l.archived : true))
      .filter((l) => (hasStatus ? ["Follow Up", "Nurture"].includes(stageKey(l.status)) : true))
      .filter((l) => !!l.follow_up_at)
      .filter((l) => {
        const d = new Date(l.follow_up_at as string);
        return !Number.isNaN(d.getTime()) && d >= now && d <= end;
      })
      .sort((a, b) => new Date(a.follow_up_at as string).getTime() - new Date(b.follow_up_at as string).getTime());
  }, [leads, leadColumns]);

  const sourceStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads) {
      const src = l.source || "Unknown";
      map[src] = (map[src] ?? 0) + 1;
    }
    return map;
  }, [leads]);

  const resetForm = () => {
    setEditingId(null);
    setFullName("");
    setSource("Instagram");
    setLeadSource("Instagram");
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
    setLeadSource(l.lead_source ?? l.source ?? "Instagram");
    setHandle(l.handle ?? "");
    setPhone(l.phone ?? "");
    setEmail(l.email ?? "");
    setNotes(l.notes ?? "");
    setProgram(l.program ?? "April Group Mentorship");
    setStatus(stageKey(l.status));
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveLead = async () => {
    const hasArchived = leadColumns.includes("archived");
    const hasLeadSource = leadColumns.includes("lead_source");
    const currentEditingLead = editingId ? leads.find((l) => l.id === editingId) ?? null : null;
    const payload: any = {
      full_name: fullName.trim() ? fullName.trim() : null,
      source: source || null,
      handle: handle.trim() ? handle.trim() : null,
      phone: phone.trim() ? phone.trim() : null,
      email: email.trim() ? email.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      program: program || null,
      status: status
    };
    if (hasLeadSource) {
      payload.lead_source = leadSource || null;
    }
    if (hasArchived) payload.archived = false;

    if (!payload.full_name) {
      alert("Name is required");
      return;
    }

    if (stageKey(status) === "Follow Up" && !currentEditingLead?.follow_up_at) {
      alert(
        editingId
          ? "Set a follow-up date first (use the Follow/Change date button), then save as Follow Up."
          : "Create the lead first, then use the Follow button to set Follow Up with a date."
      );
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
    setFormOpen(false);
    fetchAll();
  };

  const setStatusOnly = async (l: Lead, newStatus: string) => {
    if (stageKey(newStatus) === "Follow Up") {
      openFollow(l);
      return;
    }
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

    setNoteOpen(false);
    setNoteLead(null);
    setNoteText("");
    setNoteContactedAt("");
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

  const closeNoteModal = () => {
    setNoteOpen(false);
    setNoteLead(null);
    setNoteText("");
    setNoteContactedAt("");
  };

  const archiveLead = async (l: Lead) => {
    if (!leadColumns.includes("archived")) {
      alert("Archive is unavailable because this leads table has no archived column.");
      return;
    }
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

  const convertToStudent = async (l: Lead) => {
    if (l.student_id) return;
    setConvertError(null);
    setConvertSuccess(null);
    const email = (l.email ?? "").trim().toLowerCase();
    if (email) {
      const existing = await supabase
        .from("students")
        .select("id,email")
        .ilike("email", email)
        .limit(1);
      if (existing.error) {
        setConvertError(existing.error.message);
        return;
      }
      if (existing.data && existing.data.length > 0) {
        const { error } = await supabase
          .from("leads")
          .delete()
          .eq("id", l.id);
        if (error) {
          setConvertError(error.message);
          return;
        }
        setConvertSuccess("Student already exists — lead removed.");
        setLeads((prev) => prev.filter((lead) => lead.id !== l.id));
        fetchAll();
        router.refresh();
        return;
      }
    }

    const safeName =
      (l.full_name ?? "").trim() ||
      (l.name ?? "").trim() ||
      email ||
      "Unnamed";
    const safeFullName = (l.full_name ?? l.name ?? "").trim() || null;

    const payload = {
      name: safeName,
      full_name: safeFullName,
      email: email || null,
      phone: l.phone ?? null,
      program: l.program ?? null,
      notes: l.notes ?? null,
      total_fee: null,
      paid_in_full: false
    };

    const inserted = await supabase
      .from("students")
      .insert(payload)
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

    setConvertSuccess("Converted.");
    setLeads((prev) => prev.filter((lead) => lead.id !== l.id));
    fetchAll();
    router.refresh();
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const stage = stageKey(status);
    const colors = STATUS_COLORS[stage] ?? STATUS_COLORS["New"];
    return (
      <span style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        background: colors.bg,
        color: colors.text,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}>
        {stage}
      </span>
    );
  };

  const ChannelBadge = ({ source }: { source: string | null }) => {
    const src = source || "Other";
    const abbr = CHANNEL_ICONS[src] || src.slice(0, 2).toUpperCase();
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.75)",
        fontSize: 11,
        fontWeight: 600,
      }}>
        <span style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          fontWeight: 800,
        }}>
          {abbr}
        </span>
        {src}
      </span>
    );
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
          style={btnSmall}
        >
          Add to Calendar
        </button>
        <a href={r.googleUrl} target="_blank" rel="noreferrer" style={linkBtnSmall}>
          Google Cal
        </a>
      </div>
    );
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
    setSelectedIds(new Set(filtered.map((l) => l.id)));
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
    const payload: any = {};
    if (leadColumns.includes("status")) payload.status = "Contacted";
    if (leadColumns.includes("last_contacted_at")) payload.last_contacted_at = new Date().toISOString();
    await bulkUpdate(payload);
  };

  const runBulkArchive = async () => {
    if (leadColumns.includes("archived")) {
      await bulkUpdate({ archived: true });
      return;
    }
    if (leadColumns.includes("status")) {
      await bulkUpdate({ status: "Archived" });
    }
  };

  const runBulkMoveStage = async (nextStage: string) => {
    if (!leadColumns.includes("status")) return;
    await bulkUpdate({ status: nextStage });
  };

  const card = (l: Lead) => {
    const name = leadName(l);
    const isOverdue = l.follow_up_at && new Date(l.follow_up_at).getTime() < Date.now();
    return (
      <div key={l.id} style={{
        border: isOverdue ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 16,
        background: isOverdue ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.03)",
        transition: "border-color 0.2s",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
              <StatusBadge status={l.status ?? "New"} />
              <ChannelBadge source={l.source} />
            </div>

            {/* Contact info row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              {l.program && (
                <span>{l.program}</span>
              )}
              {l.handle && (
                <span>@{l.handle}</span>
              )}
              {l.email && (
                <span>{l.email}</span>
              )}
              {l.phone && (
                <span>{l.phone}</span>
              )}
            </div>

            {/* Notes & timestamps */}
            {l.last_note && (
              <div style={{
                marginTop: 8, fontSize: 12, opacity: 0.9,
                padding: "6px 10px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                borderLeft: "3px solid rgba(255,255,255,0.15)"
              }}>
                {truncatePreview(l.last_note, 120)}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              {l.last_contacted_at && (
                <span>Contacted {timeAgo(l.last_contacted_at)}</span>
              )}
              {l.follow_up_at && (
                <span style={{ color: isOverdue ? "#fca5a5" : "#fcd34d" }}>
                  {isOverdue ? "Overdue: " : "Follow-up: "}
                  {new Date(l.follow_up_at).toLocaleString()}
                </span>
              )}
              {l.created_at && (
                <span>Added {timeAgo(l.created_at)}</span>
              )}
            </div>

            {followButtons(l)}
          </div>
        </div>
        {disableMarkContacted && contactedHint ? (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {contactedHint}
          </div>
        ) : null}

        {/* Action buttons */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12,
          paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)"
        }}>
          <button onClick={() => loadEdit(l)} style={btnSecondary}>Edit</button>
          <button onClick={() => openNote(l)} style={btnSecondary}>Add Note</button>
          <button onClick={() => setStatusOnly(l, "Contacted")} style={btnSecondary}>Contacted</button>
          <button onClick={() => openFollow(l)} style={btnPrimary}>Follow</button>
          <button onClick={() => setStatusOnly(l, "Nurture")} style={btnSecondary}>Nurture</button>
          <button onClick={() => setStatusOnly(l, "Confirmed")} style={{
            ...btnSecondary,
            background: "rgba(34,197,94,0.12)",
            borderColor: "rgba(34,197,94,0.25)",
          }}>Confirmed</button>
          {stageKey(l.status) === "Confirmed" && (
            <button
              onClick={() => convertToStudent(l)}
              style={{
                ...btnSecondary,
                background: "rgba(34,197,94,0.15)",
                borderColor: "rgba(34,197,94,0.3)",
              }}
              disabled={!!l.student_id}
            >
              {l.student_id ? "Converted" : "Convert to Student"}
            </button>
          )}
          <button onClick={() => setStatusOnly(l, "Lost")} style={btnDanger}>Lost</button>
          <button onClick={() => archiveLead(l)} style={btnSecondary}>Archive</button>
          <button onClick={() => deleteLead(l)} style={btnDanger}>Delete</button>
        </div>

        {l.notes && !l.last_note && (
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            {l.notes}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Leads</h2>
          <div style={{ opacity: 0.7, marginTop: 4, fontSize: 13 }}>
            Add follow-up dates, then tap Add to Calendar to get phone notifications.
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setFormOpen(!formOpen); }}
          style={{
            ...btnPrimary,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {formOpen ? "Close Form" : "+ Add Lead"}
        </button>
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

      {/* Channel stats bar */}
      {Object.keys(sourceStats).length > 0 && (
        <div style={{ ...panel, marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Leads by Channel</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(sourceStats).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
              <button
                key={src}
                onClick={() => setSourceFilter(sourceFilter === src ? "__ALL__" : src)}
                style={{
                  ...btnSecondary,
                  padding: "6px 12px",
                  fontSize: 12,
                  background: sourceFilter === src ? "rgba(79,163,255,0.2)" : "rgba(255,255,255,0.06)",
                  borderColor: sourceFilter === src ? "rgba(79,163,255,0.4)" : "rgba(255,255,255,0.12)",
                }}
              >
                {CHANNEL_ICONS[src] ? `${CHANNEL_ICONS[src]} ` : ""}{src} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Follow Ups */}
      {upcomingFollowUps.length > 0 && (
        <div style={{ ...panel, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Upcoming Follow-ups</h3>
            <span style={{
              padding: "4px 10px", borderRadius: 999,
              background: "rgba(236,72,153,0.15)", color: "#f9a8d4",
              fontSize: 12, fontWeight: 700,
            }}>
              {upcomingFollowUps.length} in next 14 days
            </span>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {upcomingFollowUps.map((l) => {
              const name = leadName(l);
              const r = buildReminder(l);
              const fileSafe = name.replace(/[^a-z0-9]+/gi, "_");
              return (
                <div key={l.id} style={{
                  border: "1px solid rgba(236,72,153,0.15)",
                  borderRadius: 12,
                  padding: 14,
                  background: "rgba(236,72,153,0.04)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{name}</div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {l.program ?? "—"} | {new Date(l.follow_up_at as string).toLocaleString()}
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>
                        {l.handle ? `@${l.handle}` : ""}{l.email ? ` | ${l.email}` : ""}{l.phone ? ` | ${l.phone}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => downloadICS(`MOM_FollowUp_${fileSafe}.ics`, r.ics)}
                        style={btnSmall}
                      >
                        Add to Calendar
                      </button>
                      <a href={r.googleUrl} target="_blank" rel="noreferrer" style={linkBtnSmall}>
                        Google Cal
                      </a>
                      <button onClick={() => loadEdit(l)} style={btnSecondary}>Edit</button>
                      <button onClick={() => openFollow(l)} style={btnSecondary}>Change date</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {formOpen && (
        <div style={{ ...panel, marginTop: 12 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>{editingId ? "Edit Lead" : "Add Lead"}</h3>

          <div style={grid2}>
            <div>
              <label style={label}>Full name *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Program</label>
              <select value={program} onChange={(e) => setProgram(e.target.value)} style={input}>
                {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label style={label}>Channel / Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} style={input}>
                {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </div>

            <div>
              <label style={label}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={label}>Handle (without @)</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="username"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                style={input}
              />
            </div>

            <div>
              <label style={label}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                style={{ ...input, minHeight: 60, resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={saveLead} style={{ ...btnPrimary, padding: "12px 24px", fontWeight: 700 }}>
              {editingId ? "Update Lead" : "Add Lead"}
            </button>
            <button onClick={() => { resetForm(); setFormOpen(false); }} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters & list */}
      <div style={{ ...panel, marginTop: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads..."
            style={{ ...inputSmall, minWidth: 180, flex: "1 1 180px" }}
          />

          <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} style={inputSmall}>
            <option value="__ALL__">All Programs</option>
            {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputSmall}>
            <option value="__ALL__">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={inputSmall}>
            <option value="__ALL__">All Channels</option>
            {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.7, fontSize: 13 }}>
            {loading ? "Loading..." : `${filtered.length} of ${leads.length} leads`}
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
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {filtered.map(card)}
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
            No leads found. {leads.length > 0 ? "Try adjusting your filters." : "Add your first lead!"}
          </div>
        )}
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
              style={{ ...input, width: "100%", minHeight: 110, marginTop: 12, resize: "vertical" }}
            />

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Last contacted (optional)</div>
              <input
                type="datetime-local"
                value={noteContactedAt}
                onChange={(e) => setNoteContactedAt(e.target.value)}
                style={{ ...input, width: "100%" }}
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
  maxWidth: 1100,
  margin: "20px auto",
  padding: 16,
  color: "white",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  background: "linear-gradient(180deg, #071427 0%, #061122 100%)",
  minHeight: "100vh"
};

const panel: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)"
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

const followBadgeBase: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  border: "1px solid transparent"
};

function followBadgeTone(tone: "overdue" | "today" | "future"): React.CSSProperties {
  if (tone === "overdue") {
    return {
      color: "#ffd6d6",
      background: "rgba(255, 99, 99, 0.18)",
      borderColor: "rgba(255, 99, 99, 0.45)"
    };
  }
  if (tone === "today") {
    return {
      color: "#ffe0c2",
      background: "rgba(255, 159, 64, 0.2)",
      borderColor: "rgba(255, 159, 64, 0.5)"
    };
  }
  return {
    color: "#cce6ff",
    background: "rgba(80, 150, 255, 0.2)",
    borderColor: "rgba(80, 150, 255, 0.5)"
  };
}

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 6,
  fontWeight: 600,
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
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(31,79,255,0.4)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
};

const btnDanger: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.15)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 13,
};

const btnSecondarySmall: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
};

const btnDangerSmall: React.CSSProperties = {
  ...btnSecondarySmall,
  background: "rgba(255,59,48,0.15)",
  borderColor: "rgba(255,59,48,0.3)",
  color: "#fca5a5",
};

const btnSmall: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(31,79,255,0.3)",
  background: "rgba(31,79,255,0.15)",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

const linkBtnSmall: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.8)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
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
