"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { PROGRAMS } from "../../lib/constants";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Student = {
  id: string;
  full_name: string;
  email: string | null;
  program: string | null;
  total_fee: number;
  due_date: string | null;
  reminder_at: string | null;
  notes: string | null;
  created_at: string | null;
};

type Payment = {
  id: string;
  student_id: string;
  amount: number;
  paid_at: string | null;
  method: string | null;
  note: string | null;
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
  const name = student.full_name.trim();
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
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function csvEscape(value: string) {
  const safe = value.replace(/"/g, "\"\"");
  return `"${safe}"`;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [program, setProgram] = useState<string>(PROGRAMS[0]);
  const [totalFee, setTotalFee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [notes, setNotes] = useState("");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderStudent, setReminderStudent] = useState<Student | null>(null);
  const [reminderDate, setReminderDate] = useState("");

  const fetchAll = async () => {
    setLoading(true);

    const [studentsRes, paymentsRes] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("paid_at", { ascending: false })
    ]);

    if (studentsRes.error) {
      console.error(studentsRes.error);
      setStudents([]);
    } else {
      const rows = (studentsRes.data ?? []).map((s: any) => ({
        ...s,
        total_fee: toNumber(s.total_fee)
      })) as Student[];
      setStudents(rows);
    }

    if (paymentsRes.error) {
      console.error(paymentsRes.error);
      setPayments([]);
    } else {
      const rows = (paymentsRes.data ?? []).map((p: any) => ({
        ...p,
        amount: toNumber(p.amount)
      })) as Payment[];
      setPayments(rows);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
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

  const dueSoon = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    return students
      .filter((s) => {
        const totalPaid = totalsByStudent.get(s.id) ?? 0;
        const balance = s.total_fee - totalPaid;
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

  const resetForm = () => {
    setEditingId(null);
    setFullName("");
    setEmail("");
    setProgram(PROGRAMS[0]);
    setTotalFee("");
    setDueDate("");
    setReminderAt("");
    setNotes("");
  };

  const loadEdit = (s: Student) => {
    setEditingId(s.id);
    setFullName(s.full_name ?? "");
    setEmail(s.email ?? "");
    setProgram(s.program ?? PROGRAMS[0]);
    setTotalFee(s.total_fee ? String(s.total_fee) : "");
    setDueDate(toLocalInputValue(s.due_date));
    setReminderAt(toLocalInputValue(s.reminder_at));
    setNotes(s.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveStudent = async () => {
    const payload: any = {
      full_name: fullName.trim(),
      email: email.trim() ? email.trim() : null,
      program: program.trim() ? program.trim() : null,
      total_fee: Number(totalFee),
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      notes: notes.trim() ? notes.trim() : null
    };

    if (!payload.full_name) {
      alert("Full name is required");
      return;
    }

    if (!Number.isFinite(payload.total_fee) || payload.total_fee <= 0) {
      alert("Total fee must be a positive number");
      return;
    }

    let res;
    if (editingId) {
      res = await supabase.from("students").update(payload).eq("id", editingId);
    } else {
      res = await supabase.from("students").insert(payload);
    }

    if (res.error) {
      alert(res.error.message);
      return;
    }

    resetForm();
    fetchAll();
  };

  const openPayments = (s: Student) => {
    setPaymentStudent(s);
    setPaymentAmount("");
    setPaymentDate(toLocalInputValue(new Date().toISOString()));
    setPaymentMethod("");
    setPaymentNote("");
    setPaymentOpen(true);
  };

  const savePayment = async () => {
    if (!paymentStudent) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount");
      return;
    }

    const payload = {
      student_id: paymentStudent.id,
      amount,
      paid_at: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
      method: paymentMethod.trim() ? paymentMethod.trim() : null,
      note: paymentNote.trim() ? paymentNote.trim() : null
    };

    const { error } = await supabase.from("payments").insert(payload);
    if (error) {
      alert(error.message);
      return;
    }

    setPaymentAmount("");
    setPaymentMethod("");
    setPaymentNote("");
    fetchAll();
  };

  const deletePayment = async (p: Payment) => {
    const ok = confirm("Delete this payment?");
    if (!ok) return;
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) alert(error.message);
    else fetchAll();
  };

  const openReminder = (s: Student) => {
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
    fetchAll();
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
      "Due Date",
      "Reminder At",
      "Notes"
    ];

    const rows = students.map((s) => {
      const totalPaid = totalsByStudent.get(s.id) ?? 0;
      const balance = s.total_fee - totalPaid;
      const status = balance <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
      return [
        s.full_name ?? "",
        s.email ?? "",
        s.program ?? "",
        s.total_fee.toFixed(2),
        totalPaid.toFixed(2),
        balance.toFixed(2),
        status,
        s.due_date ? new Date(s.due_date).toLocaleString() : "",
        s.reminder_at ? new Date(s.reminder_at).toLocaleString() : "",
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

  return (
    <div style={page}>
      <h2 style={{ margin: 0 }}>Students</h2>
      <div style={{ opacity: 0.85, marginTop: 6 }}>
        Track total fees (after discounts) and split payments per student.
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Due Soon (next 14 days)</h3>
          <div style={{ opacity: 0.85 }}>{dueSoon.length} reminders</div>
        </div>

        {dueSoon.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.85 }}>No upcoming due dates or reminders in the next 14 days.</div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {dueSoon.map((s) => {
              const totalPaid = totalsByStudent.get(s.id) ?? 0;
              const balance = s.total_fee - totalPaid;
              const r = s.reminder_at ? buildReminder(s) : null;
              const fileSafe = s.full_name.replace(/[^a-z0-9]+/gi, "_");
              return (
                <div key={s.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{s.full_name}</div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {s.program ?? "—"} • Balance: {money(balance)}
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {s.due_date ? `Due: ${new Date(s.due_date).toLocaleString()}` : "No due date"}{s.reminder_at ? ` • Reminder: ${new Date(s.reminder_at).toLocaleString()}` : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {r && (
                        <>
                          <button
                            onClick={() => downloadICS(`MOM_StudentReminder_${fileSafe}.ics`, r.ics)}
                            style={btnPrimary}
                          >
                            Add to Calendar (ICS)
                          </button>
                          <a href={r.googleUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                            Google Calendar
                          </a>
                        </>
                      )}
                      <button onClick={() => openReminder(s)} style={btnSecondary}>Set Reminder</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? "Edit Student" : "Add Student"}</h3>

        <div style={grid2}>
          <div>
            <label style={label}>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          </div>

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
            <label style={label}>Total fee (after discount)</label>
            <input
              type="number"
              step="0.01"
              value={totalFee}
              onChange={(e) => setTotalFee(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>Due date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>Reminder at</label>
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              style={input}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} style={input} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={saveStudent} style={btnPrimary}>{editingId ? "Update Student" : "Save Student"}</button>
          <button onClick={resetForm} style={btnSecondary}>Clear</button>
        </div>
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ marginLeft: "auto", opacity: 0.85 }}>
            {loading ? "Loading..." : `${students.length} students`}
          </div>
          <button onClick={exportCsv} style={btnSecondary}>Export CSV</button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {students.map((s) => {
            const totalPaid = totalsByStudent.get(s.id) ?? 0;
            const balance = s.total_fee - totalPaid;
            const status = balance <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
            return (
              <div key={s.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      {s.program ?? "—"} • {status}
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 13 }}>
                      Total fee: {money(s.total_fee)} • Paid: {money(totalPaid)} • Balance: {money(balance)}
                    </div>
                    {s.due_date ? (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                        Due: {new Date(s.due_date).toLocaleString()}
                      </div>
                    ) : null}
                    {s.reminder_at ? (
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                        Reminder: {new Date(s.reminder_at).toLocaleString()}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => loadEdit(s)} style={btnSecondary}>Edit</button>
                    <button onClick={() => openPayments(s)} style={btnPrimary}>Add Payment</button>
                    <button onClick={() => openReminder(s)} style={btnSecondary}>Set Reminder</button>
                  </div>
                </div>

                {s.notes ? (
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                    {s.notes}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {paymentOpen && paymentStudent && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Payments</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              {paymentStudent.full_name}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                style={input}
              />
              <input
                type="datetime-local"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={input}
              />
              <input
                placeholder="Method (cash, Zelle, card)"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={input}
              />
              <input
                placeholder="Note"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                style={input}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setPaymentOpen(false)} style={btnSecondary}>Close</button>
              <button onClick={savePayment} style={btnPrimary}>Add Payment</button>
            </div>

            <div style={{ marginTop: 16, fontWeight: 700 }}>Previous payments</div>
            <div style={{ display: "grid", gap: 8, marginTop: 8, maxHeight: 240, overflow: "auto" }}>
              {(paymentsByStudent.get(paymentStudent.id) ?? []).map((p) => (
                <div key={p.id} style={{ ...cardStyle, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{money(p.amount)}</div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>
                        {p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}
                        {p.method ? ` • ${p.method}` : ""}
                      </div>
                      {p.note ? (
                        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{p.note}</div>
                      ) : null}
                    </div>
                    <button onClick={() => deletePayment(p)} style={btnDanger}>Delete</button>
                  </div>
                </div>
              ))}
              {(paymentsByStudent.get(paymentStudent.id) ?? []).length === 0 && (
                <div style={{ opacity: 0.85 }}>No payments yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {reminderOpen && reminderStudent && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Set Reminder</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              {reminderStudent.full_name}
            </div>

            <input
              type="datetime-local"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              style={{ ...input, marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
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

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  textDecoration: "none"
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

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.03)"
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 12
};

const modalCard: React.CSSProperties = {
  width: 420,
  maxWidth: "100%",
  borderRadius: 14,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#0b1b33"
};
