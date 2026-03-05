"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Summary = {
  monthlySpend: number;
  monthlyPayouts: number;
  monthlyNet: number;
  monthlyRoiPct: number | null;
  lifetimeSpend: number;
  lifetimePayouts: number;
  lifetimeNet: number;
  lifetimeRoiPct: number | null;
  byFirm: {
    firm_id: string;
    firm_name: string;
    spend: number;
    payouts: number;
    net: number;
    roiPct: number | null;
  }[];
};

type EntryRow = {
  id: string;
  firm_id: string;
  firm_name: string | null;
  entry_date: string | null;
  entry_type: string;
  amount: number;
  category: string | null;
  description: string;
  notes: string | null;
  created_at: string | null;
};

type Firm = {
  id: string;
  name: string;
  platform?: string | null;
  account_size?: number | null;
  profit_split_pct?: number | null;
};

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = (v: number) => moneyFmt.format(v || 0);

export default function RoiDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [firm, setFirm] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [firmModalOpen, setFirmModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<"expense" | "payout">("expense");
  const [entryFirmId, setEntryFirmId] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [firmName, setFirmName] = useState("");
  const [firmPlatform, setFirmPlatform] = useState("");
  const [firmAccountSize, setFirmAccountSize] = useState("");
  const [firmProfitSplit, setFirmProfitSplit] = useState("");
  const [kpiMode, setKpiMode] = useState<"month" | "lifetime">("month");

  const loadFirms = async () => {
    const firmsRes = await fetch("/api/roi/firms");
    const firmsJson = await firmsRes.json();
    if (!firmsRes.ok) {
      throw new Error(firmsJson.error || "Failed to load firms");
    }
    setFirms((firmsJson.firms ?? []) as Firm[]);
    if (!entryFirmId && (firmsJson.firms ?? []).length > 0) {
      setEntryFirmId((firmsJson.firms ?? [])[0].id);
    }
    return (firmsJson.firms ?? []) as Firm[];
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ month, firm }).toString();
      const [summaryRes, entriesRes] = await Promise.all([
        fetch(`/api/roi/summary?${query}`),
        fetch(`/api/roi/entries?${query}`)
      ]);
      const summaryJson = await summaryRes.json();
      const entriesJson = await entriesRes.json();
      if (!summaryRes.ok) throw new Error(summaryJson.error || "Failed to load summary");
      if (!entriesRes.ok) throw new Error(entriesJson.error || "Failed to load entries");
      setSummary(summaryJson);
      setEntries(entriesJson.entries ?? []);
      await loadFirms();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load ROI data";
      setError(message);
      setSummary(null);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [month, firm]);

    const kpis = useMemo(() => {
    const totalSpend = kpiMode === "lifetime" ? summary?.lifetimeSpend ?? 0 : summary?.monthlySpend ?? 0;
    const totalPayouts = kpiMode === "lifetime" ? summary?.lifetimePayouts ?? 0 : summary?.monthlyPayouts ?? 0;
    const netProfit = kpiMode === "lifetime" ? summary?.lifetimeNet ?? 0 : summary?.monthlyNet ?? 0;
    const roiPercent = kpiMode === "lifetime" ? summary?.lifetimeRoiPct : summary?.monthlyRoiPct;
    return [
      { label: "Total Spend", value: money(totalSpend), tone: "red" },
      { label: "Total Payouts", value: money(totalPayouts), tone: "green" },
      { label: "Net", value: money(netProfit), tone: netProfit > 0 ? "green" : netProfit < 0 ? "red" : "neutral" },
      { label: "ROI %", value: roiPercent == null ? "—" : `${roiPercent.toFixed(1)}%`, tone: roiPercent == null ? "neutral" : roiPercent > 0 ? "green" : roiPercent < 0 ? "red" : "neutral" }
    ];
  }, [summary, kpiMode]);

  const subtitleText = kpiMode === "month" ? "Based on selected month" : "Based on lifetime totals";

  const discipline = useMemo(() => {
    const monthEntries = entries ?? [];
    const evalCount = monthEntries.filter((e) => (e.category ?? "").toLowerCase().includes("evaluation")).length;
    const resetCount = monthEntries.filter((e) => (e.category ?? "").toLowerCase().includes("reset")).length;
    return { evalCount, resetCount };
  }, [entries]);

  const recentEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const ad = a.entry_date ? new Date(a.entry_date).getTime() : 0;
      const bd = b.entry_date ? new Date(b.entry_date).getTime() : 0;
      if (ad !== bd) return bd - ad;
      const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bc - ac;
    });
    return sorted.slice(0, 5);
  }, [entries]);
  const lifetime = useMemo(() => {
    return {
      spend: money(summary?.lifetimeSpend ?? 0),
      payouts: money(summary?.lifetimePayouts ?? 0),
      net: money(summary?.lifetimeNet ?? 0),
      roi: summary?.lifetimeRoiPct == null ? "—" : `${summary?.lifetimeRoiPct.toFixed(1)}%`
    };
  }, [summary]);

  const openEntry = (type: "expense" | "payout") => {
    setEntryType(type);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setCategory("");
    setDescription("");
    setNotes("");
    if (firm !== "all") {
      setEntryFirmId(firm);
    }
    setModalOpen(true);
  };

  const openFirmModal = () => {
    setFirmName("");
    setFirmPlatform("");
    setFirmAccountSize("");
    setFirmProfitSplit("");
    setFirmModalOpen(true);
  };

  const saveFirm = async () => {
    if (!firmName.trim()) {
      alert("Firm name is required");
      return;
    }
    const payload = {
      name: firmName.trim(),
      platform: firmPlatform.trim() ? firmPlatform.trim() : null,
      account_size: firmAccountSize ? Number(firmAccountSize) : null,
      profit_split_pct: firmProfitSplit ? Number(firmProfitSplit) : null
    };
    const res = await fetch("/api/roi/firms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Failed to add firm");
      return;
    }
    setFirmModalOpen(false);
    const updated = await loadFirms();
    const createdId = json?.firm?.id;
    if (createdId) {
      setFirm(createdId);
      setEntryFirmId(createdId);
      return;
    }
    if (updated.length > 0) {
      setFirm(updated[updated.length - 1].id);
    }
  };

  const handleFirmFilterChange = (value: string) => {
    if (value === "__add__") {
      openFirmModal();
      return;
    }
    setFirm(value);
  };

  const handleEntryFirmChange = (value: string) => {
    if (value === "__add__") {
      openFirmModal();
      return;
    }
    setEntryFirmId(value);
  };

  const saveEntry = async () => {
    if (!entryFirmId) {
      alert("Select a firm");
      return;
    }
    if (!description.trim()) {
      alert("Description is required");
      return;
    }
    const payload = {
      firm_id: entryFirmId,
      entry_date: entryDate || new Date().toISOString().slice(0, 10),
      entry_type: entryType,
      amount: Number(amount || 0),
      category: category.trim() ? category.trim() : null,
      description: description.trim(),
      notes: notes.trim() ? notes.trim() : null
    };
    const res = await fetch("/api/roi/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Failed to add entry");
      return;
    }
    setModalOpen(false);
    loadAll();
  };

  return (
    <div className="container" style={{ paddingBottom: 30 }}>
      <div style={{ marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1>Prop Firm ROI</h1>
          <div className="sub">Spend, payouts, and ROI at a glance.</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input"
            />
            <select value={firm} onChange={(e) => handleFirmFilterChange(e.target.value)} className="input">
              <option value="all">All firms</option>
              {firms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              <option value="__add__">+ Add new firm</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
            <button className="btn" style={actionBtnStyle} onClick={openFirmModal}>Add Firm</button>
            <button className="btn" style={actionBtnStyle} onClick={() => openEntry("expense")}>Add Expense</button>
            <button className="btn" style={actionBtnStyle} onClick={() => openEntry("payout")}>Add Payout</button>
            <button className="btn" style={actionBtnStyle} onClick={() => router.push("/roi/entries")}>
              Manage Entries
            </button>
          </div>
        </div>
      </div>

      {firms.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 18,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexDirection: "column",
            textAlign: "center",
            background: "rgba(79, 163, 255, 0.08)",
            borderColor: "rgba(79, 163, 255, 0.25)"
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>No firms yet</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Add your first firm to start tracking ROI.</div>
          </div>
          <button className="btn" style={actionBtnStyle} onClick={openFirmModal}>Add your first firm</button>
        </div>
      ) : null}

      {error ? (
        <div
          className="card"
          style={{
            borderColor: "rgba(255, 86, 86, 0.4)",
            background: "rgba(255, 86, 86, 0.08)",
            marginBottom: 16
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Data warning</div>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>{error}</div>
        </div>
      ) : null}

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button className="btn" style={kpiMode === "month" ? toggleActiveStyle : toggleStyle} onClick={() => setKpiMode("month")}>
          This Month
        </button>
        <button className="btn" style={kpiMode === "lifetime" ? toggleActiveStyle : toggleStyle} onClick={() => setKpiMode("lifetime")}>
          Lifetime
        </button>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: 14, borderColor: k.tone === "red" ? "rgba(255, 86, 86, 0.45)" : k.tone === "green" ? "rgba(76, 200, 140, 0.4)" : "var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{loading ? "—" : k.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{subtitleText}</div>
          </div>
        ))}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Evaluations Purchased</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{loading ? "—" : discipline.evalCount}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Based on selected month</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Reset Fees</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{loading ? "—" : discipline.resetCount}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Based on selected month</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Lifetime totals</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "var(--muted)", fontSize: 13 }}>
          <span>Spend {lifetime.spend}</span>
          <span>Payouts {lifetime.payouts}</span>
          <span>Net {lifetime.net}</span>
          <span>ROI {lifetime.roi}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Performance by Firm</div>
        {loading ? (
          <div style={{ color: "var(--muted)" }}>Loading firms…</div>
        ) : (summary?.byFirm?.length ?? 0) === 0 ? (
          <div style={{ color: "var(--muted)" }}>No firm data for this month.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "8px 6px" }}>Firm</th>
                  <th style={{ padding: "8px 6px" }}>Spend</th>
                  <th style={{ padding: "8px 6px" }}>Payouts</th>
                  <th style={{ padding: "8px 6px" }}>Net</th>
                  <th style={{ padding: "8px 6px" }}>ROI %</th>
                </tr>
              </thead>
              <tbody>
                {summary?.byFirm?.map((f) => (
                  <tr key={f.firm_id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 6px" }}>{f.firm_name}</td>
                    <td style={{ padding: "8px 6px" }}>{money(f.spend)}</td>
                    <td style={{ padding: "8px 6px" }}>{money(f.payouts)}</td>
                    <td style={{ padding: "8px 6px" }}>{money(f.net)}</td>
                    <td style={{ padding: "8px 6px" }}>{f.roiPct == null ? "—" : `${f.roiPct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Recent Entries</div>
          {loading ? (
            <div style={{ color: "var(--muted)" }}>Loading entriesâ€¦</div>
          ) : recentEntries.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>No recent entries.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {recentEntries.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.firm_name ?? "â€”"}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {e.entry_date ? new Date(e.entry_date).toLocaleDateString() : "â€”"} â€¢ {e.entry_type}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{money(e.amount)}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{e.category ?? "â€”"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Entries</div>
        {loading ? (
          <div style={{ color: "var(--muted)" }}>Loading entries…</div>
        ) : entries.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>No ROI entries yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "8px 6px" }}>Firm</th>
                  <th style={{ padding: "8px 6px" }}>Date</th>
                  <th style={{ padding: "8px 6px" }}>Type</th>
                  <th style={{ padding: "8px 6px" }}>Amount</th>
                  <th style={{ padding: "8px 6px" }}>Category</th>
                  <th style={{ padding: "8px 6px" }}>Description</th>
                  <th style={{ padding: "8px 6px" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 6px" }}>{e.firm_name ?? "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{e.entry_date ? new Date(e.entry_date).toLocaleDateString() : "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{e.entry_type}</td>
                    <td style={{ padding: "8px 6px" }}>{money(e.amount)}</td>
                    <td style={{ padding: "8px 6px" }}>{e.category ?? "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{e.description}</td>
                    <td style={{ padding: "8px 6px", color: "var(--muted)" }}>{e.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{entryType === "expense" ? "Add Expense" : "Add Payout"}</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <select className="input" value={entryFirmId} onChange={(e) => handleEntryFirmChange(e.target.value)}>
                <option value="">Select firm</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
                <option value="__add__">+ Add new firm</option>
              </select>
              <input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              <input className="input" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <input className="input" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <input className="input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn" onClick={saveEntry}>Save</button>
            </div>
          </div>
        </div>
      )}

      {firmModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Add Firm</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input className="input" placeholder="Firm name" value={firmName} onChange={(e) => setFirmName(e.target.value)} />
              <input className="input" placeholder="Platform (optional)" value={firmPlatform} onChange={(e) => setFirmPlatform(e.target.value)} />
              <input className="input" type="number" placeholder="Account size (optional)" value={firmAccountSize} onChange={(e) => setFirmAccountSize(e.target.value)} />
              <input className="input" type="number" placeholder="Profit split % (optional)" value={firmProfitSplit} onChange={(e) => setFirmProfitSplit(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setFirmModalOpen(false)}>Cancel</button>
              <button className="btn" onClick={saveFirm}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999
};

const modalCard: React.CSSProperties = {
  width: 420,
  borderRadius: 14,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#0b1b33"
};

const actionBtnStyle: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10
};

const toggleStyle: React.CSSProperties = {
  height: 30,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  opacity: 0.7
};

const toggleActiveStyle: React.CSSProperties = {
  ...toggleStyle,
  opacity: 1,
  borderColor: "rgba(79, 163, 255, 0.6)"
};


