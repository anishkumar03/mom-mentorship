"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { PAYMENT_METHODS } from "../../lib/constants";
import { usePrograms } from "../../lib/usePrograms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Student = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  program: string | null;
  total_fee: number;
  due_date: string | null;
  reminder_at: string | null;
  paid_in_full: boolean | null;
  notes: string | null;
  created_at: string | null;
};

type Payment = {
  id: string;
  student_id: string;
  amount: number;
  paid_at: string | null;
  method?: string | null;
  note?: string | null;
  created_at: string | null;
};


function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function buildReminder(student: Student) {
  const name = displayName(student);
  const whenISO = student.reminder_at ?? "";
  const start = new Date(whenISO);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  const title = `Payment Reminder: ${name}`;
  const detailsParts = [
    student.program ? `Program: ${student.program}` : "",
    student.email ? `Email: ${student.email}` : "",
    student.notes ? `Notes: ${student.notes}` : ""
  ].filter(Boolean);

  const details = detailsParts.join("\n");
  const uid = `${student.id}-${Date.now()}@mindovermarkets`;

  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mind Over Markets//Student Reminder//EN
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

  return { ics, googleUrl, start, end };
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value || 0);
}

function displayName(s: Student) {
  const raw = s.full_name || s.name || s.email || "Unnamed";
  return raw.replace(/[^\x20-\x7E]+/g, "").trim() || "Unnamed";
}

function csvEscape(value: string) {
  const safe = value.replace(/"/g, "\"\"");
  return `"${safe}"`;
}

function paymentPercentage(totalFee: number, totalPaid: number) {
  if (totalFee <= 0) return 0;
  return Math.min(100, Math.round((totalPaid / totalFee) * 100));
}

export default function StudentsPage() {
  const router = useRouter();
  const { programs } = usePrograms();
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [studentColumns, setStudentColumns] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("All");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [program, setProgram] = useState<string>("");
  const [totalFee, setTotalFee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [paidInFull, setPaidInFull] = useState(false);
  const [notes, setNotes] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
