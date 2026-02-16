"use client";

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
  status: string | null;
  program: string | null;
  call_scheduled_at: string | null;
  follow_up_at: string | null;
  created_at?: string | null;
};

const container: React.CSSProperties = {
  maxWidth: 1100,
  margin: "22px auto",
  padding: "0 14px",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
  color: "#EAF1FF",
};

const board: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(180px, 1fr))",
  gap: 12,
  overflowX: "auto",
  paddingBottom: 12,
};

const colBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 12,
  minHeight: 420,
};

const colTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontWeight: 700,
  letterSpacing: 0.2,
  marginBottom: 10,
};

const pill: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 999,
  padding: "2px 9px",
  fontSize: 12,
};

const card: React.CSSProperties = {
  background: "rgba(10, 20, 40, 0.6)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 10,
};

const btnRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
};

const btn: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#EAF1FF",
  borderRadius: 10,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "rgba(64, 140, 255, 0.18)",
  border: "1px solid rgba(64, 140, 255, 0.30)",
};

function fmt(dt: string | null) {
  if (!dt) return "-";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function digitsOnly(v: string) {
  return (v || "").replace(/[^\d]/g, "");
}

function whatsappUrl(phone: string, msg: string) {
  const p = digitsOnly(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState("Loading...");

  const columns = useMemo(
    () => [
      { key: "new", title: "New" },
      { key: "contacted", title: "Contacted" },
      { key: "call_scheduled", title: "Call Scheduled" },
      { key: "follow_up", title: "Follow Up" },
      { key: "won", title: "Won" },
      { key: "lost", title: "Lost" },
    ],
    []
  );

  const refresh = async () => {
    setStatus("Loading...");
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(error.message);
      return;
    }

    setLeads((data as Lead[]) ?? []);
    setStatus("Ready");
  };

  useEffect(() => {
    refresh();
  }, []);

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    await refresh();
  };

  const setStatusOnly = async (lead: Lead, next: string) => {
    await updateLead(lead.id, { status: next });
  };

  const setCallDone = async (lead: Lead) => {
    await updateLead(lead.id, { status: "follow_up" });
  };

  const setFollowIn7Days = async (lead: Lead) => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    await updateLead(lead.id, { status: "follow_up", follow_up_at: d.toISOString() });
  };

  const convertToStudent = async (lead: Lead) => {
    const email = (lead.email || "").trim();
    if (!email) {
      alert("Add an email for this lead first, then Convert.");
      return;
    }

    // UPSERT to avoid duplicate email error
    const { error: upsertErr } = await supabase
      .from("students")
      .upsert(
        {
          email,
          name: lead.name || "Student",
          cohort: lead.program || "Unknown",
          payment_status: "unknown",
        },
        { onConflict: "email" }
      );

    if (upsertErr) {
      alert(upsertErr.message);
      return;
    }

    await updateLead(lead.id, { status: "won" });
  };

  const openWhatsApp = (lead: Lead) => {
    const phone = (lead.phone || "").trim();
    if (!phone) {
      alert("No phone saved for this lead.");
      return;
    }
    const msg =
      "Hi, this is Anish from Mind Over Markets. Just following up about the mentorship. What day and time works best for you this week?";
    window.open(whatsappUrl(phone, msg), "_blank");
  };

  const grouped = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const c of columns) map[c.key] = [];
    for (const l of leads) {
      const k = (l.status || "new").toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(l);
    }
    return map;
  }, [leads, columns]);

  return (
    <div style={container}>
      <h1 style={{ margin: "6px 0 10px" }}>Pipeline</h1>
      <div style={{ opacity: 0.9, marginBottom: 12 }}>{status}</div>

      <div style={board}>
        {columns.map((c) => (
          <div key={c.key} style={colBox}>
            <div style={colTitle}>
              <div>{c.title}</div>
              <div style={pill}>{(grouped[c.key] || []).length}</div>
            </div>

            {(grouped[c.key] || []).map((lead) => (
              <div key={lead.id} style={card}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {lead.name || "Lead"}
                </div>

                <div style={{ opacity: 0.9, fontSize: 12, marginTop: 6 }}>
                  {(lead.source || "instagram")}{" "}
                  {lead.handle ? `| ${lead.handle}` : ""}{" "}
                  {lead.phone ? `| ${lead.phone}` : ""}
                </div>

                {lead.program && (
                  <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>
                    Program: {lead.program}
                  </div>
                )}

                <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>
                  Call: {fmt(lead.call_scheduled_at)}
                </div>
                <div style={{ opacity: 0.85, fontSize: 12, marginTop: 2 }}>
                  Follow up: {fmt(lead.follow_up_at)}
                </div>

                <div style={btnRow}>
                  <button style={btn} onClick={() => setStatusOnly(lead, "new")}>
                    New
                  </button>
                  <button style={btn} onClick={() => setStatusOnly(lead, "contacted")}>
                    Contacted
                  </button>
                  <button style={btn} onClick={() => setStatusOnly(lead, "call_scheduled")}>
                    Call
                  </button>
                  <button style={btn} onClick={() => setStatusOnly(lead, "follow_up")}>
                    Follow
                  </button>

                  <button style={btnPrimary} onClick={() => convertToStudent(lead)}>
                    Convert
                  </button>
                  <button style={btn} onClick={() => setStatusOnly(lead, "lost")}>
                    Lost
                  </button>
                  <button style={btn} onClick={() => openWhatsApp(lead)}>
                    WhatsApp
                  </button>
<button style={btn} onClick={() => archiveLead(lead)}>Archive</button>
<button style={btn} onClick={() => deleteLead(lead)}>Delete</button>

                  <button style={btn} onClick={() => setCallDone(lead)}>
                    Call done
                  </button>
                  <button style={btn} onClick={() => setFollowIn7Days(lead)}>
                    +1 week
                  </button>
<button style={btn} onClick={() => archiveLead(lead)}>Archive</button>
<button style={btn} onClick={() => deleteLead(lead)}>Delete</button>
<button style={btn} onClick={() => archiveLead(lead)}>Archive</button>
<button style={btn} onClick={() => deleteLead(lead)}>Delete</button>

<button
  onClick={async () => {
    await supabase.from("leads").update({ archived: true }).eq("id", l.id);
    location.reload();
  }}
  style={{ marginLeft: 8 }}
>
  Archive
</button>

<button
  onClick={async () => {
    if (!confirm("Delete this lead permanently?")) return;
    await supabase.from("leads").delete().eq("id", l.id);
    location.reload();
  }}
  style={{ marginLeft: 8, background: "#7a1f1f" }}
>
  Delete
</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ opacity: 0.7, fontSize: 12 }}>
        Tip: Pipeline is the “stage board”. Leads page is the “data entry + list”.
      </div>
    </div>
  );
}









