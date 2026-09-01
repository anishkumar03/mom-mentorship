"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PropAccount = {
  id: string;
  account_name: string;
  firm: string | null;
  account_size: number;
  status: string | null;
  created_at: string | null;
};

type Snapshot = {
  id: string;
  account_id: string;
  snapshot_date: string | null;
  balance: number;
  pnl: number;
  drawdown: number;
  max_drawdown: number;
  profit_factor: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  largest_win: number;
  largest_loss: number;
  notes: string | null;
  created_at: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function pct(value: number) {
  return `${(value || 0).toFixed(2)}%`;
}

function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const STATUS_OPTIONS = ["Active", "Funded", "Evaluation", "Passed", "Failed", "Breached", "Payout", "Withdrawn"];
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active: { bg: "rgba(34,197,94,0.15)", text: "#86efac" },
  Funded: { bg: "rgba(34,197,94,0.2)", text: "#4ade80" },
  Evaluation: { bg: "rgba(59,130,246,0.15)", text: "#93c5fd" },
  Passed: { bg: "rgba(34,197,94,0.25)", text: "#86efac" },
  Failed: { bg: "rgba(239,68,68,0.15)", text: "#fca5a5" },
  Breached: { bg: "rgba(239,68,68,0.2)", text: "#f87171" },
  Payout: { bg: "rgba(168,85,247,0.15)", text: "#c4b5fd" },
  Withdrawn: { bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.5)" },
};

export default function PropAccountsPage() {
  const [accounts, setAccounts] = useState<PropAccount[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [firm, setFirm] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [status, setStatus] = useState("Active");

  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotAccount, setSnapshotAccount] = useState<PropAccount | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [sBalance, setSBalance] = useState("");
  const [sPnl, setSPnl] = useState("");
  const [sDrawdown, setSDrawdown] = useState("");
  const [sMaxDrawdown, setSMaxDrawdown] = useState("");
  const [sProfitFactor, setSProfitFactor] = useState("");
  const [sWinRate, setSWinRate] = useState("");
  const [sTotalTrades, setSTotalTrades] = useState("");
  const [sWinningTrades, setSWinningTrades] = useState("");
  const [sLosingTrades, setSLosingTrades] = useState("");
  const [sAvgWin, setSAvgWin] = useState("");
  const [sAvgLoss, setSAvgLoss] = useState("");
  const [sLargestWin, setSLargestWin] = useState("");
  const [sLargestLoss, setSLargestLoss] = useState("");
  const [sNotes, setSNotes] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [pastedPreview, setPastedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detailAccount, setDetailAccount] = useState<PropAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prop_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setAccounts([]);
    } else {
      setAccounts(
        (data ?? []).map((a: Record<string, unknown>) => ({
          ...a,
          account_size: toNumber(a.account_size),
        })) as PropAccount[]
      );
    }
    setLoading(false);
  };

  const fetchSnapshots = async () => {
    const { data, error } = await supabase
      .from("prop_account_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false });
    if (error) {
      console.error(error);
      setSnapshots([]);
    } else {
      setSnapshots(
        (data ?? []).map((s: Record<string, unknown>) => ({
          ...s,
          balance: toNumber(s.balance),
          pnl: toNumber(s.pnl),
          drawdown: toNumber(s.drawdown),
          max_drawdown: toNumber(s.max_drawdown),
          profit_factor: toNumber(s.profit_factor),
          win_rate: toNumber(s.win_rate),
          total_trades: toNumber(s.total_trades),
          winning_trades: toNumber(s.winning_trades),
          losing_trades: toNumber(s.losing_trades),
          avg_win: toNumber(s.avg_win),
          avg_loss: toNumber(s.avg_loss),
          largest_win: toNumber(s.largest_win),
          largest_loss: toNumber(s.largest_loss),
        })) as Snapshot[]
      );
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchSnapshots();
  }, []);

  const snapshotsByAccount = useMemo(() => {
    const map = new Map<string, Snapshot[]>();
    for (const s of snapshots) {
      if (!map.has(s.account_id)) map.set(s.account_id, []);
      map.get(s.account_id)!.push(s);
    }
    return map;
  }, [snapshots]);

  const latestSnapshot = useCallback(
    (accountId: string): Snapshot | null => {
      const list = snapshotsByAccount.get(accountId);
      return list && list.length > 0 ? list[0] : null;
    },
    [snapshotsByAccount]
  );

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (statusFilter !== "All") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => {
        const searchable = [a.account_name, a.firm, a.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
    }
    return result;
  }, [accounts, searchQuery, statusFilter]);

  const summaryStats = useMemo(() => {
    let totalPnl = 0;
    let totalBalance = 0;
    let activeCount = 0;
    let fundedCount = 0;
    for (const a of accounts) {
      const snap = latestSnapshot(a.id);
      if (snap) {
        totalPnl += snap.pnl;
        totalBalance += snap.balance;
      }
      if (a.status === "Active" || a.status === "Funded" || a.status === "Evaluation") activeCount++;
      if (a.status === "Funded") fundedCount++;
    }
    return { totalPnl, totalBalance, activeCount, fundedCount, total: accounts.length };
  }, [accounts, latestSnapshot]);

  const resetForm = () => {
    setEditingId(null);
    setAccountName("");
    setFirm("");
    setAccountSize("");
    setStatus("Active");
  };

  const loadEdit = (a: PropAccount) => {
    setEditingId(a.id);
    setAccountName(a.account_name);
    setFirm(a.firm ?? "");
    setAccountSize(a.account_size ? String(a.account_size) : "");
    setStatus(a.status ?? "Active");
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAccount = async () => {
    if (!accountName.trim()) {
      alert("Account name is required");
      return;
    }
    const payload = {
      account_name: accountName.trim(),
      firm: firm.trim() || null,
      account_size: Number(accountSize) || 0,
      status: status || "Active",
    };

    let res;
    if (editingId) {
      res = await supabase.from("prop_accounts").update(payload).eq("id", editingId).select("*").single();
    } else {
      res = await supabase.from("prop_accounts").insert(payload).select("*").single();
    }
    if (res.error) {
      alert(res.error.message);
      return;
    }
    resetForm();
    setFormOpen(false);
    await fetchAccounts();
  };

  const deleteAccount = async (a: PropAccount) => {
    const ok = confirm(`Delete account "${a.account_name}"? All snapshots will also be deleted. This cannot be undone.`);
    if (!ok) return;
    setDeletingId(a.id);
    const { error } = await supabase.from("prop_accounts").delete().eq("id", a.id);
    if (error) alert(error.message);
    else {
      await fetchAccounts();
      await fetchSnapshots();
      if (detailAccount?.id === a.id) setDetailAccount(null);
    }
    setDeletingId(null);
  };

  const resetSnapshotForm = () => {
    setSnapshotDate(new Date().toISOString().slice(0, 10));
    setSBalance("");
    setSPnl("");
    setSDrawdown("");
    setSMaxDrawdown("");
    setSProfitFactor("");
    setSWinRate("");
    setSTotalTrades("");
    setSWinningTrades("");
    setSLosingTrades("");
    setSAvgWin("");
    setSAvgLoss("");
    setSLargestWin("");
    setSLargestLoss("");
    setSNotes("");
    setPastedPreview(null);
    setExtractError(null);
  };

  const openSnapshot = (a: PropAccount) => {
    setSnapshotAccount(a);
    resetSnapshotForm();
    setSnapshotOpen(true);
  };

  const saveSnapshot = async () => {
    if (!snapshotAccount) return;
    const payload = {
      account_id: snapshotAccount.id,
      snapshot_date: snapshotDate || new Date().toISOString().slice(0, 10),
      balance: Number(sBalance) || 0,
      pnl: Number(sPnl) || 0,
      drawdown: Number(sDrawdown) || 0,
      max_drawdown: Number(sMaxDrawdown) || 0,
      profit_factor: Number(sProfitFactor) || 0,
      win_rate: Number(sWinRate) || 0,
      total_trades: Number(sTotalTrades) || 0,
      winning_trades: Number(sWinningTrades) || 0,
      losing_trades: Number(sLosingTrades) || 0,
      avg_win: Number(sAvgWin) || 0,
      avg_loss: Number(sAvgLoss) || 0,
      largest_win: Number(sLargestWin) || 0,
      largest_loss: Number(sLargestLoss) || 0,
      notes: sNotes.trim() || null,
    };

    const { error } = await supabase.from("prop_account_snapshots").insert(payload);
    if (error) {
      alert(error.message);
      return;
    }
    setSnapshotOpen(false);
    resetSnapshotForm();
    await fetchSnapshots();
  };

  const deleteSnapshot = async (snap: Snapshot) => {
    const ok = confirm("Delete this snapshot?");
    if (!ok) return;
    const { error } = await supabase.from("prop_account_snapshots").delete().eq("id", snap.id);
    if (error) alert(error.message);
    else await fetchSnapshots();
  };

  const extractFromScreenshot = async (dataUrl: string) => {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch("/api/prop-accounts/extract-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) {
        setExtractError(json.error || "Extraction failed");
        setExtracting(false);
        return;
      }
      const d = json.data;
      if (d.balance != null) setSBalance(String(d.balance));
      if (d.pnl != null) setSPnl(String(d.pnl));
      if (d.drawdown != null) setSDrawdown(String(d.drawdown));
      if (d.max_drawdown != null) setSMaxDrawdown(String(d.max_drawdown));
      if (d.profit_factor != null) setSProfitFactor(String(d.profit_factor));
      if (d.win_rate != null) setSWinRate(String(d.win_rate));
      if (d.total_trades != null) setSTotalTrades(String(d.total_trades));
      if (d.winning_trades != null) setSWinningTrades(String(d.winning_trades));
      if (d.losing_trades != null) setSLosingTrades(String(d.losing_trades));
      if (d.avg_win != null) setSAvgWin(String(d.avg_win));
      if (d.avg_loss != null) setSAvgLoss(String(d.avg_loss));
      if (d.largest_win != null) setSLargestWin(String(d.largest_win));
      if (d.largest_loss != null) setSLargestLoss(String(d.largest_loss));
      if (d.account_name && !accountName) setAccountName(d.account_name);
      if (d.firm && !firm) setFirm(d.firm);
      if (d.status) {
        const matchedStatus = STATUS_OPTIONS.find(
          (s) => s.toLowerCase() === String(d.status).toLowerCase()
        );
        if (matchedStatus && snapshotAccount) {
          await supabase.from("prop_accounts").update({ status: matchedStatus }).eq("id", snapshotAccount.id);
          fetchAccounts();
        }
      }
    } catch (err) {
      console.error(err);
      setExtractError("Failed to extract data from screenshot");
    }
    setExtracting(false);
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!snapshotOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            setPastedPreview(dataUrl);
            extractFromScreenshot(dataUrl);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    },
    [snapshotOpen]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPastedPreview(dataUrl);
      extractFromScreenshot(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const exportCsv = () => {
    const header = [
      "Account Name", "Firm", "Account Size", "Status",
      "Balance", "P&L", "Drawdown %", "Max Drawdown %",
      "Profit Factor", "Win Rate %", "Total Trades",
      "Winning Trades", "Losing Trades", "Avg Win", "Avg Loss",
      "Largest Win", "Largest Loss", "Snapshot Date",
    ];
    const rows = accounts.map((a) => {
      const s = latestSnapshot(a.id);
      return [
        a.account_name, a.firm ?? "", String(a.account_size), a.status ?? "",
        s ? String(s.balance) : "", s ? String(s.pnl) : "",
        s ? String(s.drawdown) : "", s ? String(s.max_drawdown) : "",
        s ? String(s.profit_factor) : "", s ? String(s.win_rate) : "",
        s ? String(s.total_trades) : "", s ? String(s.winning_trades) : "",
        s ? String(s.losing_trades) : "", s ? String(s.avg_win) : "",
        s ? String(s.avg_loss) : "", s ? String(s.largest_win) : "",
        s ? String(s.largest_loss) : "", s?.snapshot_date ?? "",
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prop_accounts.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (detailAccount) {
    const acctSnapshots = snapshotsByAccount.get(detailAccount.id) ?? [];
    const latest = acctSnapshots[0] ?? null;
    const statusColor = STATUS_COLORS[detailAccount.status ?? ""] ?? {
      bg: "rgba(255,255,255,0.08)",
      text: "rgba(255,255,255,0.6)",
    };

    return (
      <div style={page}>
        <button
          onClick={() => setDetailAccount(null)}
          style={{ ...btnSecondary, marginBottom: 12 }}
        >
          &larr; Back to Accounts
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{detailAccount.account_name}</h2>
          {detailAccount.firm && (
            <span style={{ opacity: 0.6, fontSize: 14 }}>{detailAccount.firm}</span>
          )}
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: statusColor.bg,
              color: statusColor.text,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {detailAccount.status ?? "Unknown"}
          </span>
        </div>

        <div style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>
          Account Size: {money(detailAccount.account_size)}
        </div>

        {latest && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            <MetricCard label="Balance" value={money(latest.balance)} />
            <MetricCard
              label="P&L"
              value={money(latest.pnl)}
              color={latest.pnl >= 0 ? "#86efac" : "#fca5a5"}
            />
            <MetricCard label="Drawdown" value={pct(latest.drawdown)} color="#fcd34d" />
            <MetricCard label="Max Drawdown" value={pct(latest.max_drawdown)} color="#fca5a5" />
            <MetricCard label="Profit Factor" value={latest.profit_factor.toFixed(2)} />
            <MetricCard label="Win Rate" value={pct(latest.win_rate)} />
            <MetricCard label="Total Trades" value={String(latest.total_trades)} />
            <MetricCard label="Wins / Losses" value={`${latest.winning_trades} / ${latest.losing_trades}`} />
            <MetricCard label="Avg Win" value={money(latest.avg_win)} color="#86efac" />
            <MetricCard label="Avg Loss" value={money(latest.avg_loss)} color="#fca5a5" />
            <MetricCard label="Largest Win" value={money(latest.largest_win)} color="#86efac" />
            <MetricCard label="Largest Loss" value={money(latest.largest_loss)} color="#fca5a5" />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => openSnapshot(detailAccount)} style={btnPrimary}>
            + Update Performance
          </button>
          <button onClick={() => loadEdit(detailAccount)} style={btnSecondary}>
            Edit Account
          </button>
        </div>

        <div style={{ ...panel, marginTop: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Performance History</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {acctSnapshots.length === 0 && (
              <div style={{ opacity: 0.5, fontSize: 13, padding: 20, textAlign: "center" }}>
                No snapshots yet. Click &quot;Update Performance&quot; or paste a screenshot (Ctrl+V).
              </div>
            )}
            {acctSnapshots.map((s) => (
              <div key={s.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {s.snapshot_date
                        ? new Date(s.snapshot_date + "T00:00:00").toLocaleDateString()
                        : "No date"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 6, fontSize: 13 }}>
                      <span>Bal: <strong>{money(s.balance)}</strong></span>
                      <span>
                        P&L:{" "}
                        <strong style={{ color: s.pnl >= 0 ? "#86efac" : "#fca5a5" }}>
                          {money(s.pnl)}
                        </strong>
                      </span>
                      <span>DD: <strong style={{ color: "#fcd34d" }}>{pct(s.drawdown)}</strong></span>
                      <span>PF: <strong>{s.profit_factor.toFixed(2)}</strong></span>
                      <span>WR: <strong>{pct(s.win_rate)}</strong></span>
                      <span>Trades: <strong>{s.total_trades}</strong></span>
                    </div>
                    {s.notes && (
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{s.notes}</div>
                    )}
                  </div>
                  <button onClick={() => deleteSnapshot(s)} style={btnDangerSmall}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {snapshotOpen && snapshotAccount && (
          <SnapshotModal
            snapshotAccount={snapshotAccount}
            snapshotDate={snapshotDate}
            setSnapshotDate={setSnapshotDate}
            sBalance={sBalance} setSBalance={setSBalance}
            sPnl={sPnl} setSPnl={setSPnl}
            sDrawdown={sDrawdown} setSDrawdown={setSDrawdown}
            sMaxDrawdown={sMaxDrawdown} setSMaxDrawdown={setSMaxDrawdown}
            sProfitFactor={sProfitFactor} setSProfitFactor={setSProfitFactor}
            sWinRate={sWinRate} setSWinRate={setSWinRate}
            sTotalTrades={sTotalTrades} setSTotalTrades={setSTotalTrades}
            sWinningTrades={sWinningTrades} setSWinningTrades={setSWinningTrades}
            sLosingTrades={sLosingTrades} setSLosingTrades={setSLosingTrades}
            sAvgWin={sAvgWin} setSAvgWin={setSAvgWin}
            sAvgLoss={sAvgLoss} setSAvgLoss={setSAvgLoss}
            sLargestWin={sLargestWin} setSLargestWin={setSLargestWin}
            sLargestLoss={sLargestLoss} setSLargestLoss={setSLargestLoss}
            sNotes={sNotes} setSNotes={setSNotes}
            pastedPreview={pastedPreview}
            extracting={extracting}
            extractError={extractError}
            fileInputRef={fileInputRef}
            handleFileUpload={handleFileUpload}
            saveSnapshot={saveSnapshot}
            onClose={() => { setSnapshotOpen(false); resetSnapshotForm(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>Prop Accounts</h2>
          <div style={{ opacity: 0.6, marginTop: 4, fontSize: 13 }}>
            Track your prop firm accounts, performance, and P&amp;L. Paste a screenshot to auto-fill stats.
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setFormOpen(!formOpen); }}
          style={{ ...btnPrimary, padding: "10px 20px", fontSize: 14, fontWeight: 700 }}
        >
          {formOpen ? "Close Form" : "+ Add Account"}
        </button>
      </div>

      {accounts.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Total Accounts</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{summaryStats.total}</div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Active</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#86efac" }}>
              {summaryStats.activeCount}
            </div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Total P&amp;L</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginTop: 4,
                color: summaryStats.totalPnl >= 0 ? "#86efac" : "#fca5a5",
              }}
            >
              {money(summaryStats.totalPnl)}
            </div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>Total Balance</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
              {money(summaryStats.totalBalance)}
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div style={{ ...panel, marginTop: 12 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>
            {editingId ? "Edit Account" : "Add Account"}
          </h3>
          <div style={grid2}>
            <div>
              <label style={label}>Account Name *</label>
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. FTMO 100K #1"
                style={input}
              />
            </div>
            <div>
              <label style={label}>Firm</label>
              <input
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                placeholder="e.g. FTMO, TopStep, Apex"
                style={input}
              />
            </div>
            <div>
              <label style={label}>Account Size</label>
              <input
                type="number"
                step="0.01"
                value={accountSize}
                onChange={(e) => setAccountSize(e.target.value)}
                placeholder="100000"
                style={input}
              />
            </div>
            <div>
              <label style={label}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={saveAccount} style={{ ...btnPrimary, padding: "12px 24px", fontWeight: 700 }}>
              {editingId ? "Update Account" : "Save Account"}
            </button>
            <button onClick={() => { resetForm(); setFormOpen(false); }} style={btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ ...panel, marginTop: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...inputSmall, minWidth: 140 }}
          >
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            style={{ ...inputSmall, minWidth: 180, flex: "1 1 180px" }}
          />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.6, fontSize: 13 }}>
              {loading ? "Loading..." : `${filteredAccounts.length} accounts`}
            </span>
            <button onClick={exportCsv} style={btnSecondary}>Export CSV</button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {filteredAccounts.map((a) => {
            const snap = latestSnapshot(a.id);
            const statusColor = STATUS_COLORS[a.status ?? ""] ?? {
              bg: "rgba(255,255,255,0.08)",
              text: "rgba(255,255,255,0.6)",
            };

            return (
              <div
                key={a.id}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  borderColor:
                    a.status === "Funded"
                      ? "rgba(34,197,94,0.2)"
                      : a.status === "Failed" || a.status === "Breached"
                      ? "rgba(239,68,68,0.15)"
                      : "rgba(255,255,255,0.08)",
                }}
                onClick={() => setDetailAccount(a)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{a.account_name}</span>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: statusColor.bg,
                          color: statusColor.text,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {a.status ?? "Unknown"}
                      </span>
                    </div>

                    <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
                      {a.firm ?? "No firm"} | Size: {money(a.account_size)}
                    </div>

                    {snap && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, fontSize: 13 }}>
                        <span>
                          Balance: <strong>{money(snap.balance)}</strong>
                        </span>
                        <span>
                          P&amp;L:{" "}
                          <strong style={{ color: snap.pnl >= 0 ? "#86efac" : "#fca5a5" }}>
                            {money(snap.pnl)}
                          </strong>
                        </span>
                        <span>
                          DD: <strong style={{ color: "#fcd34d" }}>{pct(snap.drawdown)}</strong>
                        </span>
                        <span>
                          PF: <strong>{snap.profit_factor.toFixed(2)}</strong>
                        </span>
                        <span>
                          WR: <strong>{pct(snap.win_rate)}</strong>
                        </span>
                      </div>
                    )}

                    {!snap && (
                      <div style={{ opacity: 0.4, fontSize: 12, marginTop: 6 }}>
                        No performance data yet — click to add a snapshot
                      </div>
                    )}
                  </div>

                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", alignContent: "flex-start" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button onClick={() => openSnapshot(a)} style={btnPrimary}>
                      Update
                    </button>
                    <button onClick={() => loadEdit(a)} style={btnSecondary}>
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAccount(a)}
                      style={btnDanger}
                      disabled={deletingId === a.id}
                    >
                      {deletingId === a.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!loading && filteredAccounts.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>
            {accounts.length > 0
              ? "No accounts match your search."
              : "No prop accounts yet. Add your first account!"}
          </div>
        )}
      </div>

      {snapshotOpen && snapshotAccount && (
        <SnapshotModal
          snapshotAccount={snapshotAccount}
          snapshotDate={snapshotDate}
          setSnapshotDate={setSnapshotDate}
          sBalance={sBalance} setSBalance={setSBalance}
          sPnl={sPnl} setSPnl={setSPnl}
          sDrawdown={sDrawdown} setSDrawdown={setSDrawdown}
          sMaxDrawdown={sMaxDrawdown} setSMaxDrawdown={setSMaxDrawdown}
          sProfitFactor={sProfitFactor} setSProfitFactor={setSProfitFactor}
          sWinRate={sWinRate} setSWinRate={setSWinRate}
          sTotalTrades={sTotalTrades} setSTotalTrades={setSTotalTrades}
          sWinningTrades={sWinningTrades} setSWinningTrades={setSWinningTrades}
          sLosingTrades={sLosingTrades} setSLosingTrades={setSLosingTrades}
          sAvgWin={sAvgWin} setSAvgWin={setSAvgWin}
          sAvgLoss={sAvgLoss} setSAvgLoss={setSAvgLoss}
          sLargestWin={sLargestWin} setSLargestWin={setSLargestWin}
          sLargestLoss={sLargestLoss} setSLargestLoss={setSLargestLoss}
          sNotes={sNotes} setSNotes={setSNotes}
          pastedPreview={pastedPreview}
          extracting={extracting}
          extractError={extractError}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          saveSnapshot={saveSnapshot}
          onClose={() => { setSnapshotOpen(false); resetSnapshotForm(); }}
        />
      )}
    </div>
  );
}

function SnapshotModal({
  snapshotAccount,
  snapshotDate, setSnapshotDate,
  sBalance, setSBalance,
  sPnl, setSPnl,
  sDrawdown, setSDrawdown,
  sMaxDrawdown, setSMaxDrawdown,
  sProfitFactor, setSProfitFactor,
  sWinRate, setSWinRate,
  sTotalTrades, setSTotalTrades,
  sWinningTrades, setSWinningTrades,
  sLosingTrades, setSLosingTrades,
  sAvgWin, setSAvgWin,
  sAvgLoss, setSAvgLoss,
  sLargestWin, setSLargestWin,
  sLargestLoss, setSLargestLoss,
  sNotes, setSNotes,
  pastedPreview, extracting, extractError,
  fileInputRef, handleFileUpload,
  saveSnapshot, onClose,
}: {
  snapshotAccount: PropAccount;
  snapshotDate: string; setSnapshotDate: (v: string) => void;
  sBalance: string; setSBalance: (v: string) => void;
  sPnl: string; setSPnl: (v: string) => void;
  sDrawdown: string; setSDrawdown: (v: string) => void;
  sMaxDrawdown: string; setSMaxDrawdown: (v: string) => void;
  sProfitFactor: string; setSProfitFactor: (v: string) => void;
  sWinRate: string; setSWinRate: (v: string) => void;
  sTotalTrades: string; setSTotalTrades: (v: string) => void;
  sWinningTrades: string; setSWinningTrades: (v: string) => void;
  sLosingTrades: string; setSLosingTrades: (v: string) => void;
  sAvgWin: string; setSAvgWin: (v: string) => void;
  sAvgLoss: string; setSAvgLoss: (v: string) => void;
  sLargestWin: string; setSLargestWin: (v: string) => void;
  sLargestLoss: string; setSLargestLoss: (v: string) => void;
  sNotes: string; setSNotes: (v: string) => void;
  pastedPreview: string | null;
  extracting: boolean;
  extractError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  saveSnapshot: () => void;
  onClose: () => void;
}) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Update Performance</div>
        <div style={{ opacity: 0.85, marginTop: 4, fontSize: 14 }}>
          {snapshotAccount.account_name}
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 12,
            border: "2px dashed rgba(59,130,246,0.3)",
            background: "rgba(59,130,246,0.05)",
            textAlign: "center",
          }}
        >
          {pastedPreview ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pastedPreview}
                alt="Screenshot preview"
                style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, marginBottom: 8 }}
              />
              {extracting && (
                <div style={{ color: "#93c5fd", fontWeight: 600, fontSize: 13 }}>
                  Extracting data from screenshot...
                </div>
              )}
              {!extracting && !extractError && (
                <div style={{ color: "#86efac", fontWeight: 600, fontSize: 13 }}>
                  Data extracted! Review and save below.
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
                Paste a screenshot (Ctrl+V / Cmd+V) of your account performance to auto-fill
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={btnSecondary}
              >
                Or Upload Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </div>
          )}
          {extractError && (
            <div style={{ color: "#fca5a5", fontSize: 13, marginTop: 6 }}>
              {extractError}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>Date</label>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              style={input}
            />
          </div>
          <div>
            <label style={label}>Balance</label>
            <input type="number" step="0.01" placeholder="0.00" value={sBalance} onChange={(e) => setSBalance(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>P&amp;L</label>
            <input type="number" step="0.01" placeholder="0.00" value={sPnl} onChange={(e) => setSPnl(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Drawdown %</label>
            <input type="number" step="0.01" placeholder="0.00" value={sDrawdown} onChange={(e) => setSDrawdown(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Max Drawdown %</label>
            <input type="number" step="0.01" placeholder="0.00" value={sMaxDrawdown} onChange={(e) => setSMaxDrawdown(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Profit Factor</label>
            <input type="number" step="0.01" placeholder="0.00" value={sProfitFactor} onChange={(e) => setSProfitFactor(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Win Rate %</label>
            <input type="number" step="0.01" placeholder="0.00" value={sWinRate} onChange={(e) => setSWinRate(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Total Trades</label>
            <input type="number" placeholder="0" value={sTotalTrades} onChange={(e) => setSTotalTrades(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Winning Trades</label>
            <input type="number" placeholder="0" value={sWinningTrades} onChange={(e) => setSWinningTrades(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Losing Trades</label>
            <input type="number" placeholder="0" value={sLosingTrades} onChange={(e) => setSLosingTrades(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Avg Win</label>
            <input type="number" step="0.01" placeholder="0.00" value={sAvgWin} onChange={(e) => setSAvgWin(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Avg Loss</label>
            <input type="number" step="0.01" placeholder="0.00" value={sAvgLoss} onChange={(e) => setSAvgLoss(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Largest Win</label>
            <input type="number" step="0.01" placeholder="0.00" value={sLargestWin} onChange={(e) => setSLargestWin(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Largest Loss</label>
            <input type="number" step="0.01" placeholder="0.00" value={sLargestLoss} onChange={(e) => setSLargestLoss(e.target.value)} style={input} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>Notes</label>
            <textarea
              value={sNotes}
              onChange={(e) => setSNotes(e.target.value)}
              placeholder="Optional notes..."
              style={{ ...input, minHeight: 50, resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={saveSnapshot} style={btnPrimary}>Save Snapshot</button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label: metricLabel,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>{metricLabel}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          marginTop: 4,
          color: color ?? "white",
        }}
      >
        {value}
      </div>
    </div>
  );
}

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

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 6,
  fontWeight: 600,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.3)",
  color: "white",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
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

const statCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(31,79,255,0.4)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
};

const btnDanger: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.15)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 13,
};

const btnDangerSmall: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.12)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 11,
  flexShrink: 0,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255,255,255,0.03)",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalCard: React.CSSProperties = {
  width: 540,
  maxWidth: "100%",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#0b1b33",
  maxHeight: "90vh",
  overflow: "auto",
};
