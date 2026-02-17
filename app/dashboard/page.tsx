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
  status: string;
  follow_up_at: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const [statusText, setStatusText] = useState("Loading...");
  const [leads, setLeads] = useState<Lead[]>([]);

  const now = new Date();

  const stats = useMemo(() => {
    const total = leads.length;
    const won = leads.filter((l) => l.status === "won").length;
    const lost = leads.filter((l) => l.status === "lost").length;
    const active = total - won - lost;
    const conversionRate = total === 0 ? 0 : Math.round((won / total) * 100);

    const overdue = leads.filter(
      (l) =>
        l.follow_up_at &&
        new Date(l.follow_up_at) < now &&
        !["won", "lost"].includes(l.status)
    ).length;

    const today = (() => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      return leads.filter((l) => {
        if (!l.follow_up_at) return false;
        const t = new Date(l.follow_up_at);
        return t >= start && t <= end && !["won", "lost"].includes(l.status);
      }).length;
    })();

    const newCount = leads.filter((l) => l.status === "new").length;
    const contacted = leads.filter((l) => l.status === "contacted").length;
    const callScheduled = leads.filter((l) => l.status === "call_scheduled").length;
    const followUp = leads.filter((l) => l.status === "follow_up").length;

    return {
      total,
      active,
      conversionRate,
      overdue,
      today,
      won,
      lost,
      newCount,
      contacted,
      callScheduled,
      followUp,
    };
  }, [leads]);

  useEffect(() => {
    const run = async () => {
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

      const { data: rows, error } = await supabase
        .from("leads")
        .select("id,status,follow_up_at,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setStatusText(error.message);
        return;
      }

      setLeads(rows ?? []);
      setStatusText("Ready");
    };

    run();
  }, []);

  const cardStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 16,
    background: "white",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif" }}>
<h2>Dashboard</h2>
      <p>{statusText}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#555" }}>Total leads</div>
          <div style={{ fontSize: 28 }}>{stats.total}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#555" }}>Active leads</div>
          <div style={{ fontSize: 28 }}>{stats.active}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#555" }}>Conversion rate</div>
          <div style={{ fontSize: 28 }}>{stats.conversionRate}%</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#555" }}>Overdue follow ups</div>
          <div style={{ fontSize: 28 }}>{stats.overdue}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#555" }}>Today follow ups</div>
          <div style={{ fontSize: 12, marginTop: 6, color: "#555" }}>
            New: {stats.newCount} | Contacted: {stats.contacted}
          </div>
          <div style={{ fontSize: 12, marginTop: 6, color: "#555" }}>
            Call: {stats.callScheduled} | Follow up: {stats.followUp}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#555" }}>Won / Lost</div>
          <div style={{ fontSize: 28 }}>
            {stats.won} / {stats.lost}
          </div>
        </div>
      </div>
    </div>
  );
}

