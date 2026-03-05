"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadColumns, setLeadColumns] = useState<string[]>([]);
  const [debugCount, setDebugCount] = useState<number | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  const [programFilter, setProgramFilter] = useState<string>("__ALL__");
  const [statusFilter, setStatusFilter] = useState<string>("__ALL__");
  const [queryStatus, setQueryStatus] = useState<string | null>(null);
  const [queryFollowup, setQueryFollowup] = useState<string | null>(null);

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
    return leads.filter((l) => {
      if (hasProgram && programFilter !== "__ALL__" && (l.program ?? "") !== programFilter) return false;
      if (hasStatus && statusFilter !== "__ALL__" && stageKey(l.status) !== statusFilter) return false;
      if (queryStatus === "active") {
        const stage = stageKey(l.status);
        if (stage === "Lost" || stage === "Confirmed") return false;
      }
      if (queryFollowup === "today") {
        if (!l.follow_up_at) return false;
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        const t = new Date(l.follow_up_at);
        if (Number.isNaN(t.getTime()) || t < start || t > end) return false;
        if (stageKey(l.status) === "Lost") return false;
      }
      if (queryFollowup === "overdue") {
        if (!l.follow_up_at) return false;
        const t = new Date(l.follow_up_at);
        if (Number.isNaN(t.getTime()) || t >= new Date()) return false;
        if (stageKey(l.status) === "Lost") return false;
      }
      return true;
    });
  }, [leads, programFilter, statusFilter, leadColumns, queryStatus, queryFollowup]);

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
    const contactedLabel = daysAgoLabel(l.last_contacted_at ?? l.created_at ?? null);
    const badge = followUpBadge(l.follow_up_at);
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={selectedIds.has(l.id)}
                onChange={() => toggleSelected(l.id)}
                style={{ width: 16, height: 16 }}
              />
              <div style={{ fontWeight: 700 }}>{name}</div>
            </div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              {l.program ?? "—"} • {stageKey(l.status)}
            </div>
            {l.last_note ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.95 }}>
                Last note: {truncatePreview(l.last_note, 100)}
              </div>
            ) : null}
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>{contactedLabel}</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              {l.handle ? `@${l.handle}` : ""}{l.email ? ` • ${l.email}` : ""}{l.phone ? ` • ${l.phone}` : ""}
            </div>
            {l.follow_up_at ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                Follow-up: {new Date(l.follow_up_at).toLocaleString()}
              </div>
            ) : null}
            {badge ? (
              <div style={{ marginTop: 6 }}>
                <span style={{ ...followBadgeBase, ...followBadgeTone(badge.tone) }}>
                  {badge.label}
                </span>
              </div>
            ) : null}

            {followButtons(l)}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => loadEdit(l)} style={btnSecondary}>Edit</button>
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
            <button
              onClick={() => openFollow(l)}
              style={primaryAction === "follow" ? btnPrimary : btnSecondary}
            >
              Follow
            </button>
            <button onClick={() => setStatusOnly(l, "Nurture")} style={btnSecondary}>Nurture</button>
            <button
              onClick={() => setStatusOnly(l, "Confirmed")}
              style={primaryAction === "confirm" ? btnPrimary : btnSecondary}
            >
              Confirm
            </button>
            {stageKey(l.status) === "Confirmed" && (
              <>
                <button
                  onClick={() => convertToStudent(l)}
                  style={primaryAction === "convert" ? btnPrimary : btnSecondary}
                  disabled={!!l.student_id}
                >
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
              </>
            )}
            <button onClick={() => setStatusOnly(l, "Lost")} style={btnDanger}>Lost</button>
            <button onClick={() => archiveLead(l)} style={btnSecondary}>Archive</button>
            <button onClick={() => deleteLead(l)} style={btnDanger}>Delete</button>
          </div>
        </div>
        {disableMarkContacted && contactedHint ? (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {contactedHint}
          </div>
        ) : null}

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
        Add follow-up dates, then tap Add to Calendar to get phone notifications.
      </div>
      {convertError ? (
        <div style={{ ...panel, marginTop: 12, background: "rgba(255,0,0,0.08)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Convert to student failed</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{convertError}</div>
        </div>
      ) : null}
      {convertSuccess ? (
        <div style={{ ...panel, marginTop: 12, background: "rgba(46, 204, 113, 0.12)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Convert to student</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{convertSuccess}</div>
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

      {/* Upcoming Follow Ups */}
      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Upcoming Follow-ups (next 14 days)</h3>
          <div style={{ opacity: 0.85 }}>{upcomingFollowUps.length} reminders</div>
        </div>

        {upcomingFollowUps.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.85 }}>No follow-ups scheduled in the next 14 days.</div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {upcomingFollowUps.map((l) => {
              const name = leadName(l);
              const r = buildReminder(l);
              const fileSafe = name.replace(/[^a-z0-9]+/gi, "_");
              return (
                <div key={l.id} style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.03)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{name}</div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {l.program ?? "—"} • {new Date(l.follow_up_at as string).toLocaleString()}
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {l.handle ? `@${l.handle}` : ""}{l.email ? ` • ${l.email}` : ""}{l.phone ? ` • ${l.phone}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => downloadICS(`MOM_FollowUp_${fileSafe}.ics`, r.ics)}
                        style={btnPrimary}
                      >
                        Add to Calendar (ICS)
                      </button>
                      <a href={r.googleUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                        Google Calendar
                      </a>
                      <button onClick={() => loadEdit(l)} style={btnSecondary}>Edit</button>
                      <button onClick={() => openFollow(l)} style={btnSecondary}>Change date</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            <select
              value={leadSource}
              onChange={(e) => {
                setLeadSource(e.target.value);
                setSource(e.target.value);
              }}
              style={input}
            >
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
            <button onClick={selectAllVisible} style={btnSecondarySmall}>Select all</button>
            <button onClick={clearSelection} style={btnSecondarySmall}>Clear</button>
          </div>
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
  maxWidth: 1100,
  margin: "20px auto",
  padding: 12,
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
  gap: 10
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 6
};

const input: React.CSSProperties = {
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
  textDecoration: "none",
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
  padding: "10px 12px",
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




