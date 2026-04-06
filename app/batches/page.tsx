"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { usePrograms } from "../../lib/usePrograms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  full_name: string | null;
  name: string | null;
  source: string | null;
  handle: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  program: string | null;
  status: string | null;
  batch: string | null;
  archived?: boolean | null;
  created_at?: string | null;
};

function safeName(l: Lead) {
  return (l.full_name ?? l.name ?? "").trim() || "(no name)";
}

function formatBatchDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function makeBatchLabel(dateStr: string): string {
  return `${formatBatchDate(dateStr)} Batch`;
}

export default function BatchesPage() {
  const { programs } = usePrograms();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newBatchDate, setNewBatchDate] = useState("");
  const [assignBatch, setAssignBatch] = useState<string>("__NONE__");
  const [saving, setSaving] = useState(false);
  const [activeBatchTab, setActiveBatchTab] = useState<string>("__ALL__");

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .or("archived.is.null,archived.eq.false")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLeads([]);
    } else {
      setLeads(Array.isArray(data) ? (data as Lead[]) : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const confirmed = useMemo(() => {
    return leads.filter((l) => {
      const v = (l.status ?? "").toString().trim().toLowerCase().replace(/\s+/g, "");
      return v === "confirmed";
    });
  }, [leads]);

  const batches = useMemo(() => {
    const set = new Set<string>();
    for (const l of confirmed) {
      if (l.batch) set.add(l.batch);
    }
    return Array.from(set).sort();
  }, [confirmed]);

  const batchGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = { __UNASSIGNED__: [] };
    for (const b of batches) {
      groups[b] = [];
    }
    for (const l of confirmed) {
      if (l.batch && groups[l.batch]) {
        groups[l.batch].push(l);
      } else {
        groups.__UNASSIGNED__.push(l);
      }
    }
    return groups;
  }, [confirmed, batches]);

  const displayLeads = useMemo(() => {
    if (activeBatchTab === "__ALL__") return confirmed;
    if (activeBatchTab === "__UNASSIGNED__") return batchGroups.__UNASSIGNED__ ?? [];
    return batchGroups[activeBatchTab] ?? [];
  }, [confirmed, activeBatchTab, batchGroups]);

  const allBatchOptions = useMemo(() => {
    const opts = [...batches];
    if (newBatchDate) {
      const label = makeBatchLabel(newBatchDate);
      if (!opts.includes(label)) opts.push(label);
    }
    return opts.sort();
  }, [batches, newBatchDate]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === displayLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayLeads.map((l) => l.id)));
    }
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    const batchValue = assignBatch === "__NONE__" ? null : assignBatch;

    setSaving(true);
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from("leads")
      .update({ batch: batchValue })
      .in("id", ids);

    if (error) {
      console.error(error);
      alert("Failed to assign batch: " + error.message);
    } else {
      setSelectedIds(new Set());
      setAssignBatch("__NONE__");
      await fetchAll();
    }
    setSaving(false);
  };

  const handleCreateBatch = () => {
    if (!newBatchDate) return;
    const label = makeBatchLabel(newBatchDate);
    setAssignBatch(label);
    setNewBatchDate("");
  };

  return (
    <div style={page}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Batches</h2>
        <div style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>
          Organize confirmed leads into mentorship batches
        </div>
      </div>

      {/* Stats */}
      <div style={{ ...grid, marginTop: 16 }}>
        <div style={statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#86efac" }}>{confirmed.length}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Total Confirmed</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#93c5fd" }}>{batches.length}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Batches</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fbbf24" }}>{batchGroups.__UNASSIGNED__?.length ?? 0}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Unassigned</div>
        </div>
        {batches.map((b) => (
          <div key={b} style={statCard}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{batchGroups[b]?.length ?? 0}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{b}</div>
          </div>
        ))}
      </div>

      {/* Batch Tabs */}
      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            onClick={() => { setActiveBatchTab("__ALL__"); setSelectedIds(new Set()); }}
            style={{
              ...tabBtn,
              background: activeBatchTab === "__ALL__" ? "rgba(79,163,255,0.2)" : "rgba(255,255,255,0.06)",
              borderColor: activeBatchTab === "__ALL__" ? "rgba(79,163,255,0.4)" : "rgba(255,255,255,0.12)",
            }}
          >
            All ({confirmed.length})
          </button>
          <button
            onClick={() => { setActiveBatchTab("__UNASSIGNED__"); setSelectedIds(new Set()); }}
            style={{
              ...tabBtn,
              background: activeBatchTab === "__UNASSIGNED__" ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)",
              borderColor: activeBatchTab === "__UNASSIGNED__" ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.12)",
            }}
          >
            Unassigned ({batchGroups.__UNASSIGNED__?.length ?? 0})
          </button>
          {batches.map((b) => (
            <button
              key={b}
              onClick={() => { setActiveBatchTab(b); setSelectedIds(new Set()); }}
              style={{
                ...tabBtn,
                background: activeBatchTab === b ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                borderColor: activeBatchTab === b ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)",
              }}
            >
              {b} ({batchGroups[b]?.length ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Assignment Controls */}
      <div style={{ ...panel, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Assign to Batch</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          {/* Create new batch */}
          <div>
            <label style={{ fontSize: 11, opacity: 0.6, display: "block", marginBottom: 4 }}>New batch start date</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="date"
                value={newBatchDate}
                onChange={(e) => setNewBatchDate(e.target.value)}
                style={{ ...inputSmall, minWidth: 140 }}
              />
              <button
                onClick={handleCreateBatch}
                disabled={!newBatchDate}
                style={{
                  ...btnSecondary,
                  opacity: newBatchDate ? 1 : 0.4,
                }}
              >
                + Create
              </button>
            </div>
          </div>

          {/* Batch selector */}
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontSize: 11, opacity: 0.6, display: "block", marginBottom: 4 }}>Select batch</label>
            <select
              value={assignBatch}
              onChange={(e) => setAssignBatch(e.target.value)}
              style={{ ...inputSmall, width: "100%" }}
            >
              <option value="__NONE__">Remove from batch</option>
              {allBatchOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Assign button */}
          <button
            onClick={handleAssign}
            disabled={selectedIds.size === 0 || saving}
            style={{
              ...btnPrimary,
              opacity: selectedIds.size === 0 ? 0.4 : 1,
            }}
          >
            {saving ? "Saving..." : `Move ${selectedIds.size} selected`}
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected
          </div>
        )}
      </div>

      {/* Leads List */}
      <div style={{ marginTop: 12 }}>
        {displayLeads.length > 0 && (
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={selectAll} style={btnSecondary}>
              {selectedIds.size === displayLeads.length ? "Deselect All" : "Select All"}
            </button>
            <span style={{ fontSize: 13, opacity: 0.6 }}>
              {displayLeads.length} lead{displayLeads.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {loading && confirmed.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>Loading...</div>
          )}
          {!loading && displayLeads.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
              No leads in this view.
            </div>
          )}
          {displayLeads.map((l) => {
            const selected = selectedIds.has(l.id);
            return (
              <div
                key={l.id}
                onClick={() => toggleSelect(l.id)}
                style={{
                  ...card,
                  borderColor: selected ? "rgba(79,163,255,0.5)" : "rgba(255,255,255,0.08)",
                  background: selected ? "rgba(79,163,255,0.08)" : "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* Checkbox */}
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: selected ? "2px solid #4fa3ff" : "2px solid rgba(255,255,255,0.2)",
                    background: selected ? "rgba(79,163,255,0.3)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 2,
                    fontSize: 14, color: "white", fontWeight: 700,
                  }}>
                    {selected ? "\u2713" : ""}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{safeName(l)}</span>
                      {l.batch && <span style={batchBadge}>{l.batch}</span>}
                      {l.program && <span style={programBadge}>{l.program}</span>}
                      {l.source && <span style={channelBadge}>{l.source}</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                      {l.handle && <span>@{l.handle}</span>}
                      {l.email && <span>{l.email}</span>}
                      {l.phone && <span>{l.phone}</span>}
                    </div>
                    {l.notes && (
                      <div style={noteBlock}>
                        {l.notes.length > 100 ? `${l.notes.slice(0, 100).trimEnd()}...` : l.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- Styles ---- */

const page: React.CSSProperties = {
  maxWidth: 1100,
  margin: "20px auto",
  padding: 16,
  color: "white",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  background: "linear-gradient(180deg, #071427 0%, #061122 100%)",
  minHeight: "100vh",
};

const panel: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
};

const statCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 14,
  transition: "border-color 0.15s, background 0.15s",
};

const tabBtn: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const inputSmall: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.3)",
  color: "white",
  fontSize: 13,
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 10,
  border: "1px solid rgba(31,79,255,0.4)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const batchBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  background: "rgba(79,163,255,0.15)",
  color: "#93c5fd",
  fontSize: 11,
  fontWeight: 700,
};

const programBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.12)",
  color: "#86efac",
  fontSize: 11,
  fontWeight: 600,
};

const channelBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.75)",
  fontSize: 11,
  fontWeight: 600,
};

const noteBlock: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.9,
  padding: "5px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  borderLeft: "3px solid rgba(79,163,255,0.3)",
};
