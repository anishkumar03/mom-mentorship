"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Student = {
  id: string;
  name: string;
  email: string;
  cohort: string | null;
  payment_status: string | null;
};

export default function AdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [status, setStatus] = useState("Checking login...");

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? "";

      if (!email) {
        window.location.href = "/login";
        return;
      }

      if (email !== "anish@mindovermarkets.net") {
        setStatus("Access denied.");
        return;
      }

      const { data: rows, error } = await supabase
        .from("students")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStudents(rows ?? []);
      setStatus("Ready");
    };

    run();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={{ maxWidth: 1100, margin: "28px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Admin</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/dashboard" style={linkStyle}>Dashboard</Link>
          <Link href="/pipeline" style={linkStyle}>Pipeline</Link>
          <Link href="/leads" style={linkStyle}>Leads</Link>
          <Link href="/modules" style={linkStyle}>Modules</Link>
          <button onClick={logout} style={btnStyle}>Logout</button>
        </div>
      </div>

      <p style={{ marginTop: 0 }}>{status}</p>

      <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Cohort</th>
              <th style={thStyle}>Payment</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>{s.email}</td>
                <td style={tdStyle}>{s.cohort ?? ""}</td>
                <td style={tdStyle}>{s.payment_status ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  textDecoration: "none",
  color: "inherit",
  fontSize: 14,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontSize: 13,
  opacity: 0.9,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  fontSize: 14,
};

