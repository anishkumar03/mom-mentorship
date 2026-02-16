"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  name: string | null;
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: string | null;
  program: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  created_at?: string | null;
};

export default function ConfirmedPage() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [msg, setMsg] = useState("Loading...");

  const program = "April Group Mentorship";

  const load = async () => {
    setMsg("Loading...");
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("program", program)
      .not("confirmed_at", "is", null)
      .order("confirmed_at", { ascending: false });

    if (error) setMsg(error.message);
    else {
      setRows((data ?? []) as Lead[]);
      setMsg("Ready");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const exportCsv = () => {
    const headers = [
      "Name",
      "Instagram Handle",
      "Phone",
      "Email",
      "Confirmed At",
      "Paid At",
      "Notes"
    ];

    const lines = [
      headers.join(","),
      ...rows.map(r => {
        const values = [
          r.name ?? "",
          r.handle ?? "",
          r.phone ?? "",
          r.email ?? "",
          r.confirmed_at ?? "",
          r.paid_at ?? "",
          (r.notes ?? "").replace(/\r?\n/g, " ")
        ];
        return values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      })
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "april-confirmed.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20, color: "white" }}>
      <h1 style={{ marginBottom: 6 }}>Confirmed (April Group)</h1>
      <div style={{ opacity: 0.85, marginBottom: 16 }}>{msg}</div>

      <button
        onClick={exportCsv}
        style={{
          background: "#1f3558",
          color: "white",
          border: "1px solid rgba(255,255,255,0.15)",
          padding: "10px 14px",
          borderRadius: 10,
          cursor: "pointer",
          marginBottom: 14
        }}
      >
        Export CSV (Excel)
      </button>

      <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(255,255,255,0.06)" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>Name</th>
              <th style={{ textAlign: "left", padding: 10 }}>Handle</th>
              <th style={{ textAlign: "left", padding: 10 }}>Phone</th>
              <th style={{ textAlign: "left", padding: 10 }}>Email</th>
              <th style={{ textAlign: "left", padding: 10 }}>Confirmed</th>
              <th style={{ textAlign: "left", padding: 10 }}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <td style={{ padding: 10 }}>{r.name ?? ""}</td>
                <td style={{ padding: 10 }}>{r.handle ?? ""}</td>
                <td style={{ padding: 10 }}>{r.phone ?? ""}</td>
                <td style={{ padding: 10 }}>{r.email ?? ""}</td>
                <td style={{ padding: 10 }}>{r.confirmed_at ? new Date(r.confirmed_at).toLocaleString() : ""}</td>
                <td style={{ padding: 10 }}>{r.paid_at ? new Date(r.paid_at).toLocaleString() : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
