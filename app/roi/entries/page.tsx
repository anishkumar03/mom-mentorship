"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PropFirm = {
  id: string;
  name: string;
};

type PropFirmEntry = {
  id: string;
  firm_id: string;
  entry_date: string;
  entry_type: "expense" | "payout";
  amount: number;
  category: string | null;
  description: string;
  notes: string | null;
  created_at: string | null;
};

function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = (v: number) => moneyFmt.format(v || 0);

export default function RoiEntriesPage() {
  const [firms, setFirms] = useState<PropFirm[]>([]);
  const [entries, setEntries] = useState<PropFirmEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firmId, setFirmId] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [entryType, setEntryType] = useState<"expense" | "payout">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterFirm, setFilterFirm] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filterMonth) params.set("month", filterMonth);
    if (filterFirm) params.set("firm", filterFirm);
    if (filterType) params.set("type", filterType);

    const [firmsRes, entriesRes] = await Promise.all([
      fetch("/api/roi/firms"),
      fetch(`/api/roi/entries?${params.toString()}`)
    ]);

    const entriesJson: { entries?: unknown[]; error?: string } | null = entriesRes.ok ? await entriesRes.json() : null;
    const firmsJson = firmsRes.ok ? await firmsRes.json() : null;
    if (!firmsRes.ok || !entriesRes.ok) {
      setError(firmsJson?.error || entriesJson?.error || "Failed to load entries.");
      setLoading(false);
      return;
    }

    setFirms((firmsJson?.firms ?? []) as PropFirm[]);
    const entryRows = (entriesJson?.entries ?? []).map((raw) => {
      const e = raw as Partial<PropFirmEntry> & { amount?: unknown; entry_type?: string; description?: string };
      return {
        ...e,
        amount: toNumber(e.amount),
        entry_type: e.entry_type === "payout" ? "payout" : "expense",
        description: e.description ?? ""
      } as PropFirmEntry;
    });
    setEntries(entryRows);
    if (!firmId && (firmsJson?.firms ?? []).length > 0) {
      setFirmId((firmsJson?.firms ?? [])[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [filterMonth, filterFirm, filterType]);

  const firmById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of firms) map[f.id] = f.name;
    return map;
  }, [firms]);

  const resetForm = () => {
    setEditingId(null);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryType("expense");
    setAmount("");
    setCategory("");
    setDescription("");
    setNotes("");
  };

  const addOrUpdateEntry = async () => {
    if (!firmId) {
      alert("Select a firm");
      return;
    }
    if (!description.trim()) {
      alert("Description is required");
      return;
    }
    const payload = {
      firm_id: firmId,
      entry_date: entryDate ? entryDate : new Date().toISOString().slice(0, 10),
      entry_type: entryType,
      amount: amount ? Number(amount) : 0,
      category: category.trim() ? category.trim() : null,
      description: description.trim(),
      notes: notes.trim() ? notes.trim() : null
    };
    let res;
    if (editingId) {
      res = await supabase.from("roi_entries").update(payload).eq("id", editingId);
    } else {
      res = await supabase.from("roi_entries").insert(payload);
    }
    if (res.error) {
      alert(res.error.message);
      return;
    }
    resetForm();
    loadAll();
  };

  const editEntry = (e: PropFirmEntry) => {
    setEditingId(e.id);
    setFirmId(e.firm_id);
    setEntryDate(e.entry_date ?? "");
    setEntryType(e.entry_type);
    setAmount(String(e.amount));
    setCategory(e.category ?? "");
    setDescription(e.description ?? "");
    setNotes(e.notes ?? "");
  };

  const deleteEntry = async (e: PropFirmEntry) => {
    const ok = confirm("Delete this entry?");
    if (!ok) return;
    const { error: delError } = await supabase.from("roi_entries").delete().eq("id", e.id);
    if (delError) {
      alert(delError.message);
      return;
    }
    loadAll();
  };

  const exportCsv = () => {
    const header = ["Firm", "Date", "Type", "Amount", "Category", "Description", "Notes"];
    const rows = entries.map((e) => ([
      firmById[e.firm_id] ?? "Unknown",
      e.entry_date ?? "",
      e.entry_type,
      e.amount.toFixed(2),
      e.category ?? "",
      e.description ?? "",
      e.notes ?? ""
    ]));
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roi_entries.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container" style={{ paddingBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1>ROI Entries</h1>
          <div className="sub">Log payouts, fees, and daily PnL for each firm.</div>
        </div>
        <Link href="/roi-dashboard" className="card" style={{ padding: "10px 14px", fontWeight: 600 }}>
          Back to ROI
        </Link>
      </div>

      {error ? (
        <div
          className="card"
          style={{
            borderColor: "rgba(255, 86, 86, 0.4)",
            background: "rgba(255, 86, 86, 0.08)",
            marginTop: 16
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Data warning</div>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>{error}</div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Add Entry</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input type="month" className="input" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          <select className="input" value={filterFirm} onChange={(e) => setFilterFirm(e.target.value)}>
            <option value="all">All firms</option>
            {firms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All types</option>
            <option value="expense">Expense</option>
            <option value="payout">Payout</option>
          </select>
          <button onClick={exportCsv} className="btn">Export CSV</button>
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <select className="input" value={firmId} onChange={(e) => setFirmId(e.target.value)}>
            <option value="">Select firm</option>
            {firms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <select className="input" value={entryType} onChange={(e) => setEntryType(e.target.value as "expense" | "payout")}>
            <option value="expense">Expense</option>
            <option value="payout">Payout</option>
          </select>
          <input className="input" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="input" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={addOrUpdateEntry} className="btn">{editingId ? "Update Entry" : "Add Entry"}</button>
          {editingId ? (
            <button onClick={resetForm} className="btn" style={{ marginLeft: 8 }}>Cancel</button>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Entries</div>
        {loading ? (
          <div style={{ color: "var(--muted)" }}>Loading entriesâ€¦</div>
        ) : entries.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>No entries yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {entries.map((e) => (
              <div key={e.id} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--cardSoft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{firmById[e.firm_id] ?? "Unknown firm"}</div>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>
                      {e.entry_date ? new Date(e.entry_date).toLocaleDateString() : "No date"} â€¢ {e.entry_type}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{money(e.amount)}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {e.category ?? "Uncategorized"}
                    </div>
                  </div>
                </div>
                {e.description ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{e.description}</div>
                ) : null}
                {e.notes ? (
                  <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>{e.notes}</div>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn" onClick={() => editEntry(e)}>Edit</button>
                  <button className="btn" onClick={() => deleteEntry(e)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

