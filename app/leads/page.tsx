"use client";



  async function fetchReminders(selectedProgram: string) {
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      let q = supabase
        .from("leads")
        .select("*")
.or("archived.is.null,archived.eq.false")
        .eq("reminder_done", false)
        .not("reminder_at", "is", null)
        .gte("reminder_at", now.toISOString())
        .lte("reminder_at", end.toISOString())
        .order("reminder_at", { ascending: true });

      if (selectedProgram && selectedProgram !== "__ALL__") {
        q = q.eq("program", selectedProgram);
      }

      const { data } = await q;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { archiveLead, deleteLead } from "..\/lib\/leadsActions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
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

  created_at?: string | null;
};

const PROGRAMS = ["April Group Mentorship", "General Lead"] as const;

function toInputDateTimeValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function toIsoFromInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function prettyDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function waLink(phone: string | null, msg?: string) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  const text = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${cleaned}${text}`;
}

export default function LeadsPage() {
  const [statusText, setStatusText] = useState("Loading...");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchReminders(program);
        setReminders(Array.isArray(data) ? data : []);
      } catch {
        setReminders([]);
      }
    })();
  }, []);

  const [program, setProgram] = useState<string>(PROGRAMS[0]);
  const [source, setSource] = useState<string>("instagram");

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [callScheduledAt, setCallScheduledAt] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const activeLeads = useMemo(() => {
    return leads.filter((l) => (l.status ?? "new") !== "won" && (l.status ?? "new") !== "lost");
  }, [leads]);

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return activeLeads.filter((l) => l.follow_up_at && new Date(l.follow_up_at).getTime() < now).length;
  }, [activeLeads]);

  const todayCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return leads.filter((l) => {
      const t = l.created_at ? new Date(l.created_at).getTime() : 0;
      return t >= start && t < end;
    }).length;
  }, [leads]);

  const load = async () => {
    setStatusText("Loading...");
    const { data: auth } = await supabase.auth.getUser();
    const userEmail = auth.user?.email ?? "";
    if (!userEmail) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatusText(error.message);
      return;
    }

    setLeads((data as Lead[]) ?? []);
    setStatusText("Ready");
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setProgram(PROGRAMS[0]);
    setSource("instagram");
    setName("");
    setHandle("");
    setPhone("");
    setEmail("");
    setNotes("");
    setCallScheduledAt("");
    setFollowUpAt("");
  };

  const saveOrUpdate = async () => {
    setStatusText(editingId ? "Updating..." : "Saving...");

    const payload = {
      program,
      source,
      name: name.trim() || null,
      handle: handle.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      call_scheduled_at: toIsoFromInput(callScheduledAt),
      follow_up_at: toIsoFromInput(followUpAt),
    };

    if (!editingId) {
      const { error } = await supabase.from("leads").insert({
        ...payload,
        status: "new",
      });

      if (error) {
        setStatusText(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("leads").update(payload).eq("id", editingId);
      if (error) {
        setStatusText(error.message);
        return;
      }
    }

    await load();
    resetForm();
  };

  const setLeadStatus = async (id: string, newStatus: string) => {
    setStatusText("Updating...");
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", id);
    if (error) {
      setStatusText(error.message);
      return;
    }
    await load();
  };

  const setFollowPlusWeek = async (id: string) => {
    const lead = leads.find((l) => l.id === id);
    const base = lead?.follow_up_at ? new Date(lead.follow_up_at) : new Date();
    base.setDate(base.getDate() + 7);
    setStatusText("Updating...");
    const { error } = await supabase
      .from("leads")
      .update({ follow_up_at: base.toISOString(), status: "follow_up" })
      .eq("id", id);

    if (error) {
      setStatusText(error.message);
      return;
    }
    await load();
  };

  const editLead = (l: Lead) => {
    setEditingId(l.id);
    setProgram(l.program ?? PROGRAMS[0]);
    setSource(l.source ?? "instagram");
    setName(l.name ?? "");
    setHandle(l.handle ?? "");
    setPhone(l.phone ?? "");
    setEmail(l.email ?? "");
    setNotes(l.notes ?? "");
    setCallScheduledAt(toInputDateTimeValue(l.call_scheduled_at));
    setFollowUpAt(toInputDateTimeValue(l.follow_up_at));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredActive = useMemo(() => {
    return activeLeads.filter((l) => (l.program ?? PROGRAMS[0]) === program);
  }, [activeLeads, program]);

  return (
    <div style={{ maxWidth: 1100, margin: "26px auto", padding: "0 14px" }}>
      <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>Leads</h1>
      <div style={{ opacity: 0.9, marginBottom: 14 }}>{statusText}</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)" }}>
          Overdue: {overdueCount}
        </span>
        <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)" }}>
          Today: {todayCount}
        </span>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Add lead</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Program</div>
            <select value={program} onChange={(e) => setProgram(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10 }}>
  <option value="__ALL__">All programs</option>
              {PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Source</div>
            <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10 }}>
  <option value="__ALL__">All sources</option>
              <option value="instagram">instagram</option>
              <option value="whatsapp">whatsapp</option>
              <option value="referral">referral</option>
              <option value="other">other</option>
            </select>
          </div>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ padding: 10, borderRadius: 10 }} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (WhatsApp)" style={{ padding: 10, borderRadius: 10 }} />

          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Instagram handle" style={{ padding: 10, borderRadius: 10 }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ padding: 10, borderRadius: 10 }} />

          <input
            value={callScheduledAt}
            onChange={(e) => setCallScheduledAt(e.target.value)}
            type="datetime-local"
            placeholder="Call scheduled at"
            style={{ padding: 10, borderRadius: 10 }}
          />

          <input
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
            type="datetime-local"
            placeholder="Follow up at"
            style={{ padding: 10, borderRadius: 10 }}
          />

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" style={{ padding: 10, borderRadius: 10, gridColumn: "1 / -1", minHeight: 90 }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={saveOrUpdate} style={{ padding: "10px 14px", borderRadius: 10, fontWeight: 700 }}>
            {editingId ? "Update lead" : "Save lead"}
          </button>
          {editingId && (
            <button onClick={resetForm} style={{ padding: "10px 14px", borderRadius: 10 }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Active leads for: {program}</div>

      <div style={{ display: "grid", gap: 12 }}>
        {filteredActive.length === 0 ? (
          <div style={{ opacity: 0.85 }}>No active leads for this program yet.</div>
        ) : (
          filteredActive.map((l) => {
            const msg = `Hi, this is Anish from Mind Over Markets. Just following up about the mentorship. What day and time works best for you?`;
            const link = waLink(l.phone, msg);

            return (
              <div key={l.id} style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{l.name || "Lead"}</div>
                  <div style={{ opacity: 0.9, fontSize: 13 }}>Status: {l.status ?? "new"}</div>
                </div>

                <div style={{ opacity: 0.92, marginTop: 6, fontSize: 13 }}>
                  {(l.source ?? "-")}{" "}
                  {l.handle ? `| ${l.handle}` : ""}{" "}
                  {l.phone ? `| ${l.phone}` : ""}{" "}
                  {l.email ? `| ${l.email}` : ""}
                </div>

                <div style={{ opacity: 0.9, marginTop: 6, fontSize: 13 }}>
                  Call: {prettyDate(l.call_scheduled_at)}{" "}
                  <span style={{ marginLeft: 10 }}>Follow up: {prettyDate(l.follow_up_at)}</span>
                </div>

                {l.notes ? <div style={{ marginTop: 8, opacity: 0.95 }}>{l.notes}</div> : null}

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setLeadStatus(l.id, "contacted")} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    Contacted
                  </button>
                  <button onClick={() => setLeadStatus(l.id, "call_scheduled")} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    Call scheduled
                  </button>
                  <button onClick={() => setLeadStatus(l.id, "follow_up")} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    Follow up
                  </button>
                  <button onClick={() => setFollowPlusWeek(l.id)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    +1 week
                  </button>
                  <button onClick={() => setLeadStatus(l.id, "won")} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    Convert
                  </button>
                  <button onClick={() => setLeadStatus(l.id, "lost")} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    Lost
                  </button>

                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)" }}>
                      WhatsApp
                    </a>
                  ) : null}

                  <button onClick={() => editLead(l)} style={{ padding: "8px 10px", borderRadius: 10 }}>
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ height: 40 }} />
<div style={{ marginTop: 28 }}>
  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Upcoming reminders</div>
  {reminders.length === 0 ? (
    <div style={{ opacity: 0.8 }}>No reminders in the next 14 days.</div>
  ) : (
    <div style={{ display: "grid", gap: 10 }}>
      {reminders.map((r) => (
        <div key={r.id} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
          <div style={{ fontWeight: 700 }}>{r.name || "Lead"}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
            {r.reminder_at ? new Date(r.reminder_at).toLocaleString() : ""} {r.reminder_type ? "(" + r.reminder_type + ")" : ""}
          </div>
          {r.reminder_note ? (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>{r.reminder_note}</div>
          ) : null}
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
  {r.program ? `Program: ${r.program}` : ""}{r.phone ? ` | Phone: ${r.phone}` : ""}{r.email ? ` | Email: ${r.email}` : ""}
</div>
        </div>
      ))}
    </div>
  )}
</div>

    </div>
  );
}




















