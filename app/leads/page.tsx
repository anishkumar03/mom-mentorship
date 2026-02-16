"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Nav from "../components/Nav";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  full_name: string | null;
  source: string;
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  follow_up_at: string | null;
  call_scheduled_at: string | null;
  call_completed_at: string | null;
  archived: boolean;
  created_at: string;
};

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(dtLocal: string) {
  if (!dtLocal) return null;
  return new Date(dtLocal).toISOString();
}

export default function LeadsPage() {
  const [statusText, setStatusText] = useState("Loading...");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [followEdits, setFollowEdits] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    full_name: "",
    source: "instagram",
    handle: "",
    phone: "",
    email: "",
    notes: "",
    call_scheduled_at: "",
  });

  const now = new Date();

  const toIso = (dtLocal: string) => (dtLocal ? new Date(dtLocal).toISOString() : null);

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email ?? "";

    if (!email) {
      window.location.href = "/login";
      return;
    }

    if (email !== "anish@mindovermarkets.net") {
      setStatusText("Access denied");
      return;
    }

    let q = supabase.from("leads").select("*");
if (filterProgram !== "all") q = q.eq("program", filterProgram);

const { data: rows, error } = await q.order("created_at", { ascending: false });

    if (error) {
      setStatusText(error.message);
      return;
    }

    const list = ((rows as Lead[]) ?? []);
    setLeads(list);

    const seed: Record<string, string> = {};
    for (const l of list) seed[l.id] = toDatetimeLocalValue(l.follow_up_at);
    setFollowEdits(seed);

    setStatusText("Ready");
  };
const [program, setProgram] = useState("april_group");
const [filterProgram, setFilterProgram] = useState("april_group");

  useEffect(() => {
    load();
  }, []);

  const overdueCount = useMemo(() => {
    return leads.filter(
      (l) =>
        l.follow_up_at &&
        new Date(l.follow_up_at) < now &&
        !["won", "lost"].includes(l.status)
    ).length;
  }, [leads]);

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return leads.filter((l) => {
      if (!l.follow_up_at) return false;
      const t = new Date(l.follow_up_at);
      return t >= start && t <= end && !["won", "lost"].includes(l.status);
    }).length;
  }, [leads]);

  const addLead = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setStatusText("Saving...");

    const payload: any = {
      full_name: form.full_name || null,
      source: form.source,
      handle: form.handle || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      call_scheduled_at: toIso(form.call_scheduled_at),
      status: form.call_scheduled_at ? "call_scheduled" : "new",
      follow_up_at: null,
      archived: false,
    };

    const { error } = await supabase.from("leads").insert(payload);

    if (error) {
      setStatusText(error.message);
      setIsSaving(false);
      return;
    }

    setForm({
      full_name: "",
      source: "instagram",
      handle: "",
      phone: "",
      email: "",
      notes: "",
      call_scheduled_at: "",
    });

    await load();
    setIsSaving(false);
    setStatusText("Ready");
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const { error } = await supabase.from("leads").update(updates).eq("id", id);
    if (error) {
      setStatusText(error.message);
      return;
    }
    await load();
  };

  const markCallDone = async (lead: Lead) => {
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);

    await updateLead(lead.id, {
      status: "follow_up",
      call_completed_at: new Date().toISOString(),
      follow_up_at: oneWeekLater.toISOString(),
    });
  };

  const whatsappLink = (lead: Lead) => {
    const phoneRaw = (lead.phone || "").replace(/[^\d]/g, "");
    if (!phoneRaw) return "";

    const phone = phoneRaw.startsWith("1") ? phoneRaw : `1${phoneRaw}`;
    const name = lead.full_name || lead.handle || "there";

    const msg =
      `Hi ${name}, this is Anish from Mind Over Markets. ` +
      `Just following up about the mentorship call. ` +
      `What day and time works best for you this week?`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const convertToStudent = async (lead: Lead) => {
    setStatusText("Converting...");

    const name = lead.full_name || lead.handle || "New Student";
    const email = lead.email || `${lead.id}@placeholder.local`;

    const { error } = await supabase
      .from("students")
      .upsert(
        {
          name,
          email,
          cohort: "Converted Leads",
          payment_status: "unknown",
        },
        { onConflict: "email" }
      );

    if (error) {
      setStatusText(error.message);
      return;
    }

    await updateLead(lead.id, { status: "won", archived: true });
    setStatusText("Converted and archived");
  };

  const markLost = async (lead: Lead) => {
    await updateLead(lead.id, { status: "lost", archived: true });
  };

  const saveFollowUp = async (lead: Lead) => {
    const dtLocal = followEdits[lead.id] ?? "";
    const iso = localToIso(dtLocal);

    await updateLead(lead.id, {
      follow_up_at: iso,
      status: iso ? "follow_up" : lead.status,
    });
  };

  return (
    <div className="container">
      <Nav />

      <div className="card">
        <h1>Leads</h1>
        <div className="sub">{statusText}</div>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <div className="badge">Overdue: {overdueCount}</div>
          <div className="badge">Today: {todayCount}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
  <div style={{ opacity: 0.8, fontSize: 14 }}>Program</div>
  <select
    value={filterProgram}
    onChange={(e) => setFilterProgram(e.target.value)}
    style={{ padding: 10, borderRadius: 12 }}
  >
    <option value="april_group">April Group Mentorship</option>
    <option value="one_on_one">1 on 1 Mentorship</option>
    <option value="general">General</option>
    <option value="all">All</option>
  </select>
</div>



        <div className="grid2">
          <input
            placeholder="Name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />

          <select
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          >
            <option value="instagram">instagram</option>
            <option value="whatsapp">whatsapp</option>
            <option value="referral">referral</option>
            <option value="website">website</option>
          </select>

          <input
            placeholder="Instagram handle"
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
          />

          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            type="datetime-local"
            value={form.call_scheduled_at}
            onChange={(e) => setForm({ ...form, call_scheduled_at: e.target.value })}
          />
        </div>

        <textarea
          placeholder="Notes"
          style={{ width: "100%", marginTop: 10 }}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <button style={{ marginTop: 10 }} onClick={addLead} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save lead"}
        </button>
      </div>

      {leads.map((l) => (
        <div key={l.id} className="leadCard">
          <strong>{l.full_name || l.handle || "Lead"}</strong>

          <div className="meta">Status: {l.status}</div>
          <div className="meta">Phone: {l.phone || "-"}</div>
          <div className="meta">
            Call: {l.call_scheduled_at ? new Date(l.call_scheduled_at).toLocaleString() : "-"}
          </div>
          <div className="meta">
            Follow up: {l.follow_up_at ? new Date(l.follow_up_at).toLocaleString() : "-"}
          </div>

          <div className="actions">
            <button onClick={() => updateLead(l.id, { status: "contacted" })}>Contacted</button>
            <button onClick={() => updateLead(l.id, { status: "call_scheduled" })}>Call scheduled</button>
            <button className="btnPrimary" onClick={() => markCallDone(l)}>Call done</button>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="datetime-local"
                value={followEdits[l.id] ?? ""}
                onChange={(e) =>
                  setFollowEdits((prev) => ({ ...prev, [l.id]: e.target.value }))
                }
              />
              <button onClick={() => saveFollowUp(l)}>Update</button>
            </div>

            <button onClick={() => convertToStudent(l)}>Convert</button>
            <button onClick={() => markLost(l)}>Lost</button>

            {l.phone ? (
              <a href={whatsappLink(l)} target="_blank" rel="noreferrer">
                <button>WhatsApp</button>
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}


