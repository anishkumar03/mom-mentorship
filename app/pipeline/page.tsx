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
  status: string;
  follow_up_at: string | null;
  call_scheduled_at: string | null;
  archived: boolean;
  created_at: string;
};

const stages = [
  { key: "new", title: "New" },
  { key: "contacted", title: "Contacted" },
  { key: "call_scheduled", title: "Call Scheduled" },
  { key: "follow_up", title: "Follow Up" },
];

export default function PipelinePage() {
  const [statusText, setStatusText] = useState("Loading...");
  const [leads, setLeads] = useState<Lead[]>([]);

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

    const { data: rows, error } = await supabase
      .from("leads")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (error) {
      setStatusText(error.message);
      return;
    }

    setLeads((rows as Lead[]) ?? []);
    setStatusText("Ready");
  };

  useEffect(() => {
    load();
  }, []);

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of stages) map[s.key] = [];
    for (const l of leads) {
      const k = stages.find((x) => x.key === l.status)?.key ?? "new";
      map[k].push(l);
    }
    return map;
  }, [leads]);

  const move = async (leadId: string, status: string) => {
    const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
    if (error) {
      setStatusText(error.message);
      return;
    }
    await load();
  };

  return (
    <div className="container">
      <Nav />

      <div className="card">
        <h1>Pipeline</h1>
        <div className="sub">{statusText}</div>
        <div className="sub">Only active leads appear here. Won and Lost go to Archive.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {stages.map((s) => (
          <div key={s.key} className="card" style={{ minHeight: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <strong>{s.title}</strong>
              <span className="badge">{(byStage[s.key] ?? []).length}</span>
            </div>

            {(byStage[s.key] ?? []).map((l) => (
              <div key={l.id} className="leadCard" style={{ marginBottom: 10 }}>
                <strong>{l.full_name || l.handle || "Lead"}</strong>
                <div className="meta">{l.source}{l.handle ? ` | ${l.handle}` : ""}{l.phone ? ` | ${l.phone}` : ""}</div>
                <div className="actions" style={{ marginTop: 10 }}>
                  <button onClick={() => move(l.id, "new")}>New</button>
                  <button onClick={() => move(l.id, "contacted")}>Contacted</button>
                  <button onClick={() => move(l.id, "call_scheduled")}>Call</button>
                  <button onClick={() => move(l.id, "follow_up")}>Follow</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
