"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ActivityLog = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  module: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type UserSummary = {
  email: string;
  totalLogins: number;
  lastSeen: string;
  journalCompleted: number;
  status: "Active" | "At Risk" | "Inactive";
};

function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildUserSummaries(logs: ActivityLog[]): UserSummary[] {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const byEmail: Record<string, ActivityLog[]> = {};
  for (const log of logs) {
    const email = log.user_email ?? log.user_id ?? "Unknown";
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(log);
  }

  return Object.entries(byEmail).map(([email, userLogs]) => {
    const sorted = [...userLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastSeen = sorted[0].created_at;

    const recentLogs = userLogs.filter(
      (l) => new Date(l.created_at).getTime() >= thirtyDaysAgo
    );
    const uniqueLoginDays = new Set(
      recentLogs.map((l) => l.created_at.slice(0, 10))
    ).size;

    const journalCompleted = userLogs.filter((l) => l.action === "completed").length;

    const days = daysSince(lastSeen);
    const status: UserSummary["status"] =
      days <= 7 ? "Active" : days <= 14 ? "At Risk" : "Inactive";

    return { email, totalLogins: uniqueLoginDays, lastSeen, journalCompleted, status };
  }).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summaries, setSummaries] = useState<UserSummary[]>([]);
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    const run = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email ?? "";
      if (!email) {
        window.location.href = "/login";
        return;
      }
      if (email !== "anish@mindovermarkets.net") {
        setStatus("Access denied.");
        return;
      }

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        setStatus(error.message);
        return;
      }

      const rows = (data ?? []) as ActivityLog[];
      setLogs(rows.slice(0, 50));
      setSummaries(buildUserSummaries(rows));
      setStatus("ready");
    };

    run();
  }, []);

  if (status !== "ready") {
    return (
      <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px", color: "var(--text)" }}>
        <p style={{ color: "var(--muted)" }}>{status}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "28px auto", padding: "0 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "var(--text)" }}>
          Activity Dashboard
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
          User engagement overview
        </p>
      </div>

      {/* User Summary Table */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          marginBottom: 28,
          overflowX: "auto",
        }}
      >
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>User Summary</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Logins (30d)</th>
              <th style={thStyle}>Last Seen</th>
              <th style={thStyle}>Journal Entries</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {summaries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center" }}>
                  No activity data yet.
                </td>
              </tr>
            ) : (
              summaries.map((s) => (
                <tr key={s.email}>
                  <td style={tdStyle}>{s.email}</td>
                  <td style={tdStyle}>{s.totalLogins}</td>
                  <td style={tdStyle}>{formatDate(s.lastSeen)}</td>
                  <td style={tdStyle}>{s.journalCompleted}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          s.status === "Active"
                            ? "rgba(76, 200, 140, 0.15)"
                            : s.status === "At Risk"
                            ? "rgba(255, 185, 50, 0.15)"
                            : "rgba(255, 95, 95, 0.15)",
                        color:
                          s.status === "Active"
                            ? "#4cc88c"
                            : s.status === "At Risk"
                            ? "#ffb932"
                            : "#ff5f5f",
                      }}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Activity Log */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflowX: "auto",
        }}
      >
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>
            Recent Activity
          </span>
          <span style={{ marginLeft: 8, fontSize: 13, color: "var(--muted)" }}>last 50 events</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Timestamp</th>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Module</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center" }}>
                  No events logged yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ ...tdStyle, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td style={tdStyle}>{log.user_email ?? log.user_id ?? "—"}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        background: "var(--cardSoft)",
                        color: "var(--accent)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {log.module}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text)" }}>{log.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "11px 16px",
  borderBottom: "1px solid var(--border)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
  fontSize: 14,
  color: "var(--text)",
};
