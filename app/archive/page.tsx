"use client";

import { useEffect, useState } from "react";
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
  archived: boolean;
  created_at: string;
};

export default function ArchivePage() {
  const [statusText, setStatusText] = useState("Loading...");
  const [items, setItems] = useState<Lead[]>([]);

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
      .from("leads").select("*").not("archived_at", "is", null)
      .eq("archived", true)
      .order("created_at", { ascending: false });

    if (error) {
      setStatusText(error.message);
      return;
    }

    setItems((rows as Lead[]) ?? []);
    setStatusText("Ready");
  };

  useEffect(() => {
    load();
  }, []);

  const restore = async (lead: Lead) => {
    setStatusText("Restoring...");
    const { error } = await supabase
      .from("leads")
      .update({ archived: false, status: "follow_up" })
      .eq("id", lead.id);

    if (error) {
      setStatusText(error.message);
      return;
    }

    await load();
    setStatusText("Restored");
  };

  return (
    <div className="container">
      <Nav />

      <div className="card">
        <h1>Archive</h1>
        <div className="sub">{statusText}</div>
        <div className="sub">Won and Lost leads are stored here so your Leads page stays clean.</div>
      </div>

      {items.map((l) => (
        <div key={l.id} className="leadCard">
          <strong>{l.full_name || l.handle || "Lead"}</strong>
          <div className="meta">Status: {l.status}</div>
          <div className="meta">Source: {l.source}</div>
          <div className="meta">Phone: {l.phone || "-"}</div>
          <div className="meta">Email: {l.email || "-"}</div>
          <div className="meta">
            Created: {l.created_at ? new Date(l.created_at).toLocaleString() : "-"}
          </div>

          <div className="actions">
            <button onClick={() => restore(l)}>Restore</button>
          </div>
        </div>
      ))}
    </div>
  );
}

