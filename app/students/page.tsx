"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { PROGRAMS, PAYMENT_METHODS } from "../../lib/constants";

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
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [studentColumns, setStudentColumns] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [program, setProgram] = useState<string>(PROGRAMS[0]);
  const [totalFee, setTotalFee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [paidInFull, setPaidInFull] = useState(false);
  const [notes, setNotes] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<string | null>(null);
  const [paymentsTab, setPaymentsTab] = useState<string | null>(null);
  const [paymentsRange, setPaymentsRange] = useState<string | null>(null);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderStudent, setReminderStudent] = useState<Student | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    setFetchError(null);

    const studentsRes = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });

    if (studentsRes.error) {
      console.error(studentsRes.error);
      setStudents([]);
      setFetchError(studentsRes.error.message);
      setLoading(false);
      return;
    }

    const rawRows = (studentsRes.data ?? []) as any[];
    const cols = rawRows.length ? Object.keys(rawRows[0] ?? {}) : [];
    setStudentColumns(cols);

    const rows = rawRows.map((s: any) => ({
      ...s,
      total_fee: toNumber(s.total_fee),
      paid_in_full: Boolean(s.paid_in_full)
    })) as Student[];
    const filtered = rows.filter((s) => {
      const hasIdentity = Boolean(s.full_name || s.name || s.email);
      if (!hasIdentity) return false;
      if (s.email && s.email.endsWith("@placeholder")) return false;
      return true;
    });
    setStudents(filtered);
    setLoading(false);
  };

  const fetchPayments = async () => {
    try {
      console.warn("[payments] START fetchPayments");
      const paymentsRes = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      console.warn("[payments] result:", { error: paymentsRes.error, count: paymentsRes.data?.length, first: paymentsRes.data?.[0] });
      if (paymentsRes.error) {
        console.error(paymentsRes.error);
        setPayments([]);
        setPaymentsError(paymentsRes.error.message);
      } else {
        const rows = (paymentsRes.data ?? []).map((p: any) => ({
          ...p,
          amount: toNumber(p.amount),
          paid_at: p.paid_at ?? p.payment_date ?? null,
        })) as Payment[];
        setPayments(rows);
        setPaymentsError(null);
      }
    } catch (err) {
      console.warn("[payments] CATCH error:", err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchPayments();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setBalanceFilter(sp.get("balance"));
    setPaymentsTab(sp.get("tab"));
    setPaymentsRange(sp.get("range"));
  }, []);

  const paymentsByStudent = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of payments) {
      if (!map.has(p.student_id)) map.set(p.student_id, []);
      map.get(p.student_id)!.push(p);
    }
    return map;
  }, [payments]);

  const totalsByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      const current = map.get(p.student_id) ?? 0;
      map.set(p.student_id, current + toNumber(p.amount));
    }
    return map;
  }, [payments]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter((s) => {
      const searchable = [s.full_name, s.name, s.email, s.phone, s.program, s.notes]
        .filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [students, searchQuery]);

  const dueSoon = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    return students
      .filter((s) => {
        const totalPaid = totalsByStudent.get(s.id) ?? 0;
        const balance = s.total_fee - totalPaid;
        if (s.paid_in_full) return false;
        if (balance <= 0) return false;
        const due = s.due_date ? new Date(s.due_date) : null;
        const rem = s.reminder_at ? new Date(s.reminder_at) : null;
        const dueSoon = due && !Number.isNaN(due.getTime()) && due >= now && due <= end;
        const remSoon = rem && !Number.isNaN(rem.getTime()) && rem >= now && rem <= end;
        return Boolean(dueSoon || remSoon);
      })
      .sort((a, b) => {
        const aTime = a.reminder_at ?? a.due_date ?? "";
        const bTime = b.reminder_at ?? b.due_date ?? "";
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });
  }, [students, totalsByStudent]);

  const summaryStats = useMemo(() => {
    let totalRevenue = 0;
    let totalCollected = 0;
    let paidCount = 0;
    for (const s of students) {
      totalRevenue += s.total_fee;
      const paid = totalsByStudent.get(s.id) ?? 0;
      totalCollected += paid;
      if (s.paid_in_full || paid >= s.total_fee) paidCount++;
    }
    return {
      totalRevenue,
      totalCollected,
      outstanding: totalRevenue - totalCollected,
      paidCount,
      totalStudents: students.length,
    };
  }, [students, totalsByStudent]);

  const resetForm = () => {
    setEditingId(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setProgram(PROGRAMS[0]);
    setTotalFee("");
    setDueDate("");
    setReminderAt("");
    setPaidInFull(false);
    setNotes("");
  };

  const loadEdit = (s: Student) => {
    setEditingId(s.id);
    setFullName(s.name ?? s.full_name ?? "");
    setEmail(s.email ?? "");
    setPhone(s.phone ?? "");
    setProgram(s.program ?? PROGRAMS[0]);
    setTotalFee(s.total_fee ? String(s.total_fee) : "");
    setDueDate(s.due_date ?? "");
    setReminderAt(toLocalInputValue(s.reminder_at));
    setPaidInFull(Boolean(s.paid_in_full));
    setNotes(s.notes ?? "");
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveStudent = async () => {
    const current = editingId ? students.find((s) => s.id === editingId) ?? null : null;
    const wasPaidInFull = Boolean(current?.paid_in_full);
    const payload: any = {
      name: fullName.trim() ? fullName.trim() : null,
      email: email.trim() ? email.trim() : null,
      program: program.trim() ? program.trim() : null,
      total_fee: Number(totalFee),
      paid_in_full: paidInFull,
      notes: notes.trim() ? notes.trim() : null
    };

    if (studentColumns.includes("phone")) {
      payload.phone = phone.trim() ? phone.trim() : null;
    }
    if (studentColumns.includes("due_date")) {
      payload.due_date = dueDate ? dueDate : null;
    }
    if (studentColumns.includes("reminder_at")) {
      payload.reminder_at = reminderAt ? new Date(reminderAt).toISOString() : null;
    }

    if (!payload.name) {
      alert("Full name is required");
      return;
    }

    if (!Number.isFinite(payload.total_fee) || payload.total_fee <= 0) {
      alert("Total fee must be a positive number");
      return;
    }

    let res;
    if (editingId) {
      res = await supabase
        .from("students")
        .update(payload)
        .eq("id", editingId)
        .select("*")
        .single();
    } else {
      res = await supabase
        .from("students")
        .insert(payload)
        .select("*")
        .single();
    }

    if (res.error) {
      alert(res.error.message);
      return;
    }

    const savedStudent = res.data as Student;
    const shouldInsertPayment =
      savedStudent &&
      paidInFull &&
      !wasPaidInFull &&
      Number.isFinite(payload.total_fee) &&
      payload.total_fee > 0;

    if (shouldInsertPayment) {
      const amount = Number(payload.total_fee);
      const existing = await supabase
        .from("payments")
        .select("id")
        .eq("student_id", savedStudent.id)
        .eq("amount", amount)
        .limit(1);
      if (existing.error) {
        setPaymentsError(existing.error.message);
      } else if (!existing.data || existing.data.length === 0) {
        const now = new Date().toISOString();
        const insertRes = await supabase.from("payments").insert({
          student_id: savedStudent.id,
          amount,
          paid_at: now,
          payment_date: now,
        });
        if (insertRes.error) {
          // Retry with only one date column if both fail
          const retry = await supabase.from("payments").insert({
            student_id: savedStudent.id,
            amount,
            payment_date: now,
          });
          if (retry.error) {
            setPaymentsError(retry.error.message);
          }
        }
      }
    }

    resetForm();
    setFormOpen(false);
    await fetchStudents();
    await fetchPayments();
    router.refresh();
  };

  const openPayments = (s: Student) => {
    setPaymentStudent(s);
    setPaymentAmount("");
    setPaymentDate(toLocalInputValue(new Date().toISOString()));
    setPaymentMethod("");
    setPaymentNote("");
    setPaymentOpen(true);
    fetchPayments();
  };

  const savePayment = async () => {
    if (!paymentStudent) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount");
      return;
    }

    const dateVal = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
    const payload: Record<string, unknown> = {
      student_id: paymentStudent.id,
      amount,
      paid_at: dateVal,
      payment_date: dateVal,
      method: paymentMethod.trim() ? paymentMethod.trim() : null,
      note: paymentNote.trim() ? paymentNote.trim() : null
    };

    let { error } = await supabase.from("payments").insert(payload);
    if (error) {
      // Retry without paid_at in case only payment_date exists
      const { paid_at: _, ...fallback } = payload as any;
      const retry = await supabase.from("payments").insert(fallback);
      error = retry.error;
    }
    if (error) {
      alert(error.message);
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("");
    setPaymentNote("");
    fetchPayments();
    fetchStudents();
  };

  const deletePayment = async (p: Payment) => {
    const ok = confirm("Delete this payment?");
    if (!ok) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) alert(error.message);
    else {
      fetchPayments();
      fetchStudents();
    }
  };

  const openReminder = (s: Student) => {
    // eslint-disable-next-line react-hooks/purity
    const def = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    def.setSeconds(0, 0);
    setReminderStudent(s);
    setReminderDate(s.reminder_at ? toLocalInputValue(s.reminder_at) : toLocalInputValue(def.toISOString()));
    setReminderOpen(true);
  };

  const saveReminder = async () => {
    if (!reminderStudent) return;
    if (!reminderDate) {
      alert("Pick a reminder date/time");
      return;
    }
    const iso = new Date(reminderDate).toISOString();
    const { error } = await supabase
      .from("students")
      .update({ reminder_at: iso })
      .eq("id", reminderStudent.id);
    if (error) {
      alert(error.message);
      return;
    }
    setReminderOpen(false);
    setReminderStudent(null);
    setReminderDate("");
    fetchStudents();
  };

  const deleteStudent = async (student: Student) => {
    const ok = confirm("Delete this student? This cannot be undone.");
    if (!ok) return;

    setDeletingStudentId(student.id);
    const { error } = await supabase.from("students").delete().eq("id", student.id);
    if (error) {
      alert(error.message);
      setDeletingStudentId(null);
      return;
    }

    await fetchStudents();
    router.refresh();
    setDeletingStudentId(null);
  };

  const exportCsv = () => {
    const header = [
      "Full Name",
      "Email",
      "Program",
      "Total Fee",
      "Total Paid",
      "Balance Due",
      "Status",
      "paid_status",
      "Due Date",
      "Reminder At",
      "Paid In Full",
      "Notes"
    ];

    const rows = students.map((s) => {
      const totalPaid = totalsByStudent.get(s.id) ?? 0;
      const balance = Math.max(0, s.total_fee - totalPaid);
      const status = s.paid_in_full || balance <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
      const paidStatus = s.paid_in_full ? "PAID IN FULL" : balance > 0 ? "NOT PAID" : "PAID";
      return [
        displayName(s),
        s.email ?? "",
        s.program ?? "",
        s.total_fee.toFixed(2),
        totalPaid.toFixed(2),
        balance.toFixed(2),
        status,
        paidStatus,
        s.due_date ? new Date(s.due_date).toLocaleString() : "",
        s.reminder_at ? new Date(s.reminder_at).toLocaleString() : "",
        s.paid_in_full ? "Yes" : "No",
        s.notes ?? ""
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((v) => csvEscape(String(v))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const ProgressBar = ({ totalFee, totalPaid, isPaidFull }: { totalFee: number; totalPaid: number; isPaidFull: boolean }) => {
    const pct = isPaidFull ? 100 : paymentPercentage(totalFee, totalPaid);
    const barColor = pct >= 100 ? "#22c55e" : pct > 50 ? "#f59e0b" : "#3b82f6";
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.7, marginBottom: 4,
        }}>
          <span>{money(isPaidFull ? totalFee : totalPaid)} paid</span>
          <span>{pct}%</span>
        </div>
        <div style={{
          height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 999, background: barColor,
            width: `${pct}%`, transition: "width 0.3s ease",
          }} />
        </div>
      </div>
    );
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Students</h2>
          <div style={{ opacity: 0.6, marginTop: 4, fontSize: 13 }}>
            Track total fees (after discounts) and split payments per student.
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setFormOpen(!formOpen); }}
          style={{ ...btnPrimary, padding: "10px 20px", fontSize: 14, fontWeight: 700 }}
        >
          {formOpen ? "Close Form" : "+ Add Student"}
        </button>
      </div>

      {fetchError && (
        <div style={{ ...panel, marginTop: 12, background: "rgba(255,0,0,0.08)", borderColor: "rgba(255,0,0,0.2)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Failed to load students</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{fetchError}</div>
        </div>
      )}
      {paymentsError && (
        <div style={{ ...panel, marginTop: 12, background: "rgba(255,159,64,0.12)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Payments warning</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>{paymentsError}</div>
        </div>
      )}

      {/* Summary stats */}
      {students.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10, marginTop: 12,
        }}>
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Students</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{summaryStats.totalStudents}</div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Total Revenue</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{money(summaryStats.totalRevenue)}</div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Collected</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: "#86efac" }}>{money(summaryStats.totalCollected)}</div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Outstanding</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: summaryStats.outstanding > 0 ? "#fca5a5" : "#86efac" }}>
              {money(summaryStats.outstanding)}
            </div>
          </div>
        </div>
      )}

      {/* Due Soon */}
      {dueSoon.length > 0 && (
        <div style={{ ...panel, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Due Soon</h3>
            <span style={{
              padding: "4px 10px", borderRadius: 999,
              background: "rgba(245,158,11,0.15)", color: "#fcd34d",
              fontSize: 12, fontWeight: 700,
            }}>
              {dueSoon.length} in next 14 days
            </span>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {dueSoon.map((s) => {
              const totalPaid = totalsByStudent.get(s.id) ?? 0;
              const balance = s.total_fee - totalPaid;
              const r = s.reminder_at ? buildReminder(s) : null;
              const fileSafe = displayName(s).replace(/[^a-z0-9]+/gi, "_");
              return (
                <div key={s.id} style={{
                  ...cardStyle,
                  borderColor: "rgba(245,158,11,0.2)",
                  background: "rgba(245,158,11,0.04)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{displayName(s)}</div>
                      <div style={{ opacity: 0.8, fontSize: 13 }}>
                        {s.program ?? "-"} | Balance: {money(balance)}
                      </div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>
                        {s.due_date ? `Due: ${new Date(s.due_date).toLocaleString()}` : "No due date"}
                        {s.reminder_at ? ` | Reminder: ${new Date(s.reminder_at).toLocaleString()}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {r && (
                        <>
                          <button
                            onClick={() => downloadICS(`MOM_StudentReminder_${fileSafe}.ics`, r.ics)}
                            style={btnSmall}
                          >
                            Calendar
                          </button>
                          <a href={r.googleUrl} target="_blank" rel="noreferrer" style={linkBtnSmall}>
                            Google
                          </a>
                        </>
                      )}
                      <button onClick={() => openReminder(s)} style={btnSecondary}>Reminder</button>
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
          <h3 style={{ marginTop: 0, fontSize: 15 }}>{editingId ? "Edit Student" : "Add Student"}</h3>

          <div style={grid2}>
            <div>
              <label style={label}>Full name *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter full name" style={input} />
            </div>

            <div>
              <label style={label}>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" style={input} />
            </div>

            {studentColumns.includes("phone") && (
              <div>
                <label style={label}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" style={input} />
              </div>
            )}

            <div>
              <label style={label}>Program</label>
              <select
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                style={input}
              >
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={label}>Total fee (after discount) *</label>
              <input
                type="number"
                step="0.01"
                value={totalFee}
                onChange={(e) => setTotalFee(e.target.value)}
                placeholder="0.00"
                style={input}
              />
            </div>

            {studentColumns.includes("due_date") && (
              <div>
                <label style={label}>Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={input}
                />
              </div>
            )}

            {studentColumns.includes("reminder_at") && (
              <div>
                <label style={label}>Reminder at</label>
                <input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(e) => setReminderAt(e.target.value)}
                  style={input}
                />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 6 }}>
              <label style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "8px 14px", borderRadius: 10,
                background: paidInFull ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${paidInFull ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
              }}>
                <input
                  type="checkbox"
                  checked={paidInFull}
                  onChange={(e) => setPaidInFull(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#22c55e" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: paidInFull ? "#86efac" : "white" }}>
                  Paid in full
                </span>
              </label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
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
            <button onClick={saveStudent} style={{ ...btnPrimary, padding: "12px 24px", fontWeight: 700 }}>
              {editingId ? "Update Student" : "Save Student"}
            </button>
            <button onClick={() => { resetForm(); setFormOpen(false); }} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {/* Student list */}
      <div style={{ ...panel, marginTop: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            style={{ ...inputSmall, minWidth: 180, flex: "1 1 180px" }}
          />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.6, fontSize: 13 }}>
              {loading ? "Loading..." : `${filteredStudents.length} students`}
            </span>
            <button onClick={exportCsv} style={btnSecondary}>Export CSV</button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {filteredStudents.map((s) => {
            const totalPaid = totalsByStudent.get(s.id) ?? 0;
            const balance = Math.max(0, s.total_fee - totalPaid);
            const isPaidFull = !!s.paid_in_full;
            const paidDisplay = isPaidFull ? s.total_fee : totalPaid;
            const balanceDisplay = isPaidFull ? 0 : Math.max(0, s.total_fee - totalPaid);
            return (
              <div key={s.id} style={{
                ...cardStyle,
                borderColor: isPaidFull ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{displayName(s)}</span>
                      {isPaidFull && (
                        <span style={{
                          padding: "3px 10px", borderRadius: 999,
                          background: "rgba(34,197,94,0.2)", color: "#86efac",
                          fontWeight: 800, fontSize: 11,
                        }}>
                          PAID IN FULL
                        </span>
                      )}
                      {!isPaidFull && totalPaid > 0 && (
                        <span style={{
                          padding: "3px 10px", borderRadius: 999,
                          background: "rgba(245,158,11,0.15)", color: "#fcd34d",
                          fontWeight: 700, fontSize: 11,
                        }}>
                          Partial
                        </span>
                      )}
                      {!isPaidFull && totalPaid === 0 && (
                        <span style={{
                          padding: "3px 10px", borderRadius: 999,
                          background: "rgba(239,68,68,0.12)", color: "#fca5a5",
                          fontWeight: 700, fontSize: 11,
                        }}>
                          Not Paid
                        </span>
                      )}
                    </div>

                    <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
                      {s.program ?? "-"}
                      {s.email ? ` | ${s.email}` : ""}
                      {s.phone ? ` | ${s.phone}` : ""}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 6, fontSize: 13 }}>
                      <span>Fee: <strong>{money(s.total_fee)}</strong></span>
                      <span>Paid: <strong style={{ color: "#86efac" }}>{money(paidDisplay)}</strong></span>
                      {!isPaidFull && (
                        <span>Balance: <strong style={{ color: balanceDisplay > 0 ? "#fca5a5" : "#86efac" }}>
                          {money(balanceDisplay)}
                        </strong></span>
                      )}
                    </div>

                    <ProgressBar totalFee={s.total_fee} totalPaid={totalPaid} isPaidFull={isPaidFull} />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                      {s.due_date && <span>Due: {new Date(s.due_date).toLocaleDateString()}</span>}
                      {s.reminder_at && <span>Reminder: {new Date(s.reminder_at).toLocaleString()}</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", alignContent: "flex-start" }}>
                    <button onClick={() => loadEdit(s)} style={btnSecondary}>Edit</button>
                    <button onClick={() => openPayments(s)} style={btnPrimary}>Add Payment</button>
                    <button onClick={() => openReminder(s)} style={btnSecondary}>Reminder</button>
                    <button
                      onClick={() => deleteStudent(s)}
                      style={btnDanger}
                      disabled={deletingStudentId === s.id}
                    >
                      {deletingStudentId === s.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                {s.notes && (
                  <div style={{
                    marginTop: 10, fontSize: 13, opacity: 0.85,
                    padding: "6px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    borderLeft: "3px solid rgba(255,255,255,0.1)",
                  }}>
                    {s.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!loading && filteredStudents.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
            {students.length > 0 ? "No students match your search." : "No students yet. Add your first student!"}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentOpen && paymentStudent && (
        <div style={modalOverlay} onClick={() => setPaymentOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Payments</div>
            <div style={{ opacity: 0.85, marginTop: 4, fontSize: 14 }}>
              {displayName(paymentStudent)}
            </div>
            <div style={{ opacity: 0.6, fontSize: 12 }}>
              Fee: {money(paymentStudent.total_fee)} | Paid: {money(totalsByStudent.get(paymentStudent.id) ?? 0)}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div>
                <label style={label}>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Date</label>
                <input
                  type="datetime-local"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={input}
                >
                  <option value="">Select method...</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Note</label>
                <input
                  placeholder="Payment note (optional)"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  style={input}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setPaymentOpen(false)} style={btnSecondary}>Close</button>
              <button onClick={savePayment} style={btnPrimary}>Add Payment</button>
            </div>

            {/* Previous payments */}
            <div style={{ marginTop: 18, fontWeight: 700, fontSize: 13 }}>Previous payments</div>
            <div style={{ display: "grid", gap: 8, marginTop: 8, maxHeight: 240, overflow: "auto" }}>
              {(paymentsByStudent.get(paymentStudent.id) ?? []).map((p) => (
                <div key={p.id} style={{ ...cardStyle, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{money(p.amount)}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {p.paid_at ? new Date(p.paid_at).toLocaleString() : "-"}
                        {p.method && (
                          <span style={{
                            marginLeft: 8, padding: "2px 6px", borderRadius: 4,
                            background: "rgba(255,255,255,0.08)", fontSize: 11,
                          }}>
                            {p.method}
                          </span>
                        )}
                      </div>
                      {p.note && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{p.note}</div>}
                    </div>
                    <button onClick={() => deletePayment(p)} style={btnDangerSmall}>Delete</button>
                  </div>
                </div>
              ))}
              {(paymentsByStudent.get(paymentStudent.id) ?? []).length === 0 && (
                <div style={{ opacity: 0.5, fontSize: 13 }}>No payments yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {reminderOpen && reminderStudent && (
        <div style={modalOverlay} onClick={() => setReminderOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Set Reminder</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              {displayName(reminderStudent)}
            </div>

            <input
              type="datetime-local"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setReminderOpen(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveReminder} style={btnPrimary}>Save</button>
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

const statCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
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

const btnDangerSmall: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.12)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 11,
  flexShrink: 0,
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
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.7)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255,255,255,0.03)"
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
  width: 440,
  maxWidth: "100%",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#0b1b33",
  maxHeight: "90vh",
  overflow: "auto",
};
