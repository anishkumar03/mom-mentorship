"use client";

import { useEffect, useMemo, useState } from "react";
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

  program: string | null;
  status: string | null;

  follow_up_at: string | null;
  archived?: boolean | null;
  created_at?: string | null;
};

const PROGRAMS = ["April Group Mentorship", "General Lead"] as const;

function stageKey(s: any) {
  const v = (s ?? "New").toString().trim().toLowerCase().replace(/\s+/g, "");
  if (v.startsWith("follow")) return "Follow Up";
  if (v === "new") return "New";
  if (v === "contacted") return "Contacted";
  if (v === "confirmed") return "Confirmed";
  if (v === "lost") return "Lost";
  return "New";
}

function safeName(l: Lead) {
  return (l.full_name ?? l.name ?? "").trim() || "(no name)";
}

function downloadCSV(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ConfirmedPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<string>("__ALL__");

  const fetchAll = async () => {
    setLoading(true);

    let q = supabase
      .from("leads")
      .select("*")
      .or("archived.is.null,archived.eq.false")
      .order("created_at", { ascending: false });

    const { data, error } = await q;

    if (error) {
      console.error(error);
      setLeads([]);
    } else {
      setLeads(Array.isArray(data) ? (data as any) : []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const confirmed = useMemo(() => {
    return leads
      .filter((l) => stageKey(l.status) === "Confirmed")
      .filter((l) => (program === "__ALL__" ? true : (l.program ?? "") === program));
  }, [leads, program]);

  const exportConfirmed = () => {
    const header = ["Name", "Program", "Email", "Phone", "Instagram", "Status", "Notes", "Created At"];
    const body = confirmed.map((l) => [
      safeName(l),
      l.program ?? "",
      l.email ?? "",
      l.phone ?? "",
      l.handle ? `@${l.handle}` : "",
      stageKey(l.status),
      l.notes ?? "",
      l.created_at ? new Date(l.created_at).toLocaleString() : ""
    ]);

    downloadCSV(`MOM_Confirmed_${program === "__ALL__" ? "ALL" : program}.csv`, [header, ...body]);
  };

  return (
    <div style={page}>
      <h2 style={{ margin: 0 }}>Confirmed</h2>
      <div style={{ opacity: 0.85, marginTop: 6 }}>
        Only unarchived leads with status Confirmed.
      </div>

      <div style={{ ...panel, marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ opacity: 0.85 }}>Program</span>
        <select value={program} onChange={(e) => setProgram(e.target.value)} style={inputSmall}>
          <option value="__ALL__">All</option>
          {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <button onClick={exportConfirmed} style={btnPrimary}>
          Export Confirmed (CSV)
        </button>

        <div style={{ marginLeft: "auto", opacity: 0.85 }}>
          {loading ? "Loading..." : `${confirmed.length} confirmed`}
        </div>
      </div>

      <div style={{ ...panel, marginTop: 12 }}>
        {confirmed.length === 0 ? (
          <div style={{ opacity: 0.85 }}>No confirmed leads found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {confirmed.map((l) => (
              <div key={l.id} style={card}>
                <div style={{ fontWeight: 800 }}>{safeName(l)}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {l.program ?? "—"} • Confirmed
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {l.handle ? `@${l.handle}` : ""}{l.email ? ` • ${l.email}` : ""}{l.phone ? ` • ${l.phone}` : ""}
                </div>
                {l.notes ? (
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>{l.notes}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
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

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.03)"
};

const inputSmall: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.25)",
  color: "white"
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer"
};
