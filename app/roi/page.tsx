"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  platform: string | null;
  account_size: number | null;
  profit_split: number | null;
  created_at: string | null;
};

type PropFirmEntry = {
  id: string;
  firm_id: string;
  entry_date: string | null;
  pnl: number;
  fees: number;
  notes: string | null;
  created_at: string | null;
};

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function money(value: number) {
  return moneyFmt.format(value || 0);
}

function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function roiPercent(net: number, size: number | null) {
  if (!size || size <= 0) return "â€”";
  const pct = (net / size) * 100;
  return `${pct.toFixed(1)}%`;
}

export default function RoiPage() {
  const [firms, setFirms] = useState<PropFirm[]>([]);
  const [entries, setEntries] = useState<PropFirmEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [profitSplit, setProfitSplit] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    const [firmsRes, entriesRes] = await Promise.all([
      supabase.from("prop_firms").select("*").order("created_at", { ascending: false }),
      supabase.from("prop_firm_entries").select("*").order("created_at", { ascending: false })
    ]);

    if (firmsRes.error || entriesRes.error) {
      setError(firmsRes.error?.message || entriesRes.error?.message || "Failed to load ROI data.");
      setFirms([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    const firmRows = (firmsRes.data ?? []).map((f: any) => ({
      ...f,
      account_size: f.account_size != null ? toNumber(f.account_size) : null,
      profit_split: f.profit_split != null ? toNumber(f.profit_split) : null
    })) as PropFirm[];
    const entryRows = (entriesRes.data ?? []).map((e: any) => ({
      ...e,
      pnl: toNumber(e.pnl),
      fees: toNumber(e.fees)
    })) as PropFirmEntry[];

    setFirms(firmRows);
    setEntries(entryRows);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totalsByFirm = useMemo(() => {
    const map: Record<string, { pnl: number; fees: number }> = {};
    for (const e of entries) {
      if (!map[e.firm_id]) map[e.firm_id] = { pnl: 0, fees: 0 };
      map[e.firm_id].pnl += e.pnl || 0;
      map[e.firm_id].fees += e.fees || 0;
    }
    return map;
  }, [entries]);

  const overall = useMemo(() => {
    let pnl = 0;
    let fees = 0;
    let size = 0;
    for (const f of firms) {
      size += f.account_size ?? 0;
    }
    for (const e of entries) {
      pnl += e.pnl || 0;
      fees += e.fees || 0;
    }
    return { pnl, fees, net: pnl - fees, size };
  }, [firms, entries]);

  const addFirm = async () => {
    if (!name.trim()) {
      alert("Firm name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      platform: platform.trim() ? platform.trim() : null,
      account_size: accountSize ? Number(accountSize) : null,
      profit_split: profitSplit ? Number(profitSplit) : null
    };
    const { error: insertError } = await supabase.from("prop_firms").insert(payload);
    if (insertError) {
      alert(insertError.message);
      return;
    }
    setName("");
    setPlatform("");
    setAccountSize("");
    setProfitSplit("");
    loadAll();
  };

  return (
    <div className="container" style={{ paddingBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1>Prop Firm ROI</h1>
          <div className="sub">Track payouts, fees, and ROI across prop accounts.</div>
        </div>
        <Link href="/roi/entries" className="card" style={{ padding: "10px 14px", fontWeight: 600 }}>
          Manage Entries
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

      <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {[
          { label: "Total Net", value: money(overall.net) },
          { label: "Total PnL", value: money(overall.pnl) },
          { label: "Total Fees", value: money(overall.fees) },
          { label: "Total Account Size", value: money(overall.size) }
        ].map((k) => (
          <div key={k.label} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{loading ? "â€”" : k.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Add Prop Firm</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <input className="input" placeholder="Firm name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} />
          <input className="input" placeholder="Account size" type="number" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} />
          <input className="input" placeholder="Profit split %" type="number" value={profitSplit} onChange={(e) => setProfitSplit(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={addFirm} className="btn">Add Firm</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Firms</div>
        {firms.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>No prop firms yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {firms.map((f) => {
              const totals = totalsByFirm[f.id] ?? { pnl: 0, fees: 0 };
              const net = totals.pnl - totals.fees;
              return (
                <div key={f.id} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--cardSoft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{f.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        {f.platform ?? "â€”"} â€¢ Account {money(f.account_size ?? 0)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>{money(net)}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        ROI {roiPercent(net, f.account_size)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", color: "var(--muted)", fontSize: 12 }}>
                    <span>PnL {money(totals.pnl)}</span>
                    <span>Fees {money(totals.fees)}</span>
                    {f.profit_split ? <span>Split {f.profit_split}%</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

