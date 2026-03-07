"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Trade = {
  id: string;
  trade_date: string | null;
  symbol: string | null;
  direction: string | null;
  setup: string | null;
  emotion: string | null;
  pnl: number | null;
  contracts: number | null;
};

type Props = {
  trades: Trade[];
  month: string;
};

const GREEN = "#4cc88c";
const RED = "#ff6b6b";
const BLUE = "#4da3ff";
const YELLOW = "#f5c542";
const PURPLE = "#a78bfa";
const CYAN = "#22d3ee";
const ORANGE = "#fb923c";
const PINK = "#f472b6";
const CHART_COLORS = [BLUE, GREEN, PURPLE, YELLOW, CYAN, ORANGE, PINK, RED];

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPnl(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmt(n)}`;
}

export default function JournalDashboard({ trades, month }: Props) {
  const stats = useMemo(() => {
    const validTrades = trades.filter((t) => typeof t.pnl === "number" && !Number.isNaN(t.pnl));
    const totalTrades = validTrades.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        totalPnl: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        bestTrade: 0,
        worstTrade: 0,
        expectancy: 0,
        avgRR: 0,
        tradingDays: 0,
        avgPnlPerDay: 0,
        longestWinStreak: 0,
        longestLoseStreak: 0,
        maxDrawdown: 0,
      };
    }

    const pnls = validTrades.map((t) => t.pnl as number);
    const totalPnl = pnls.reduce((a, b) => a + b, 0);
    const winTrades = pnls.filter((p) => p > 0);
    const lossTrades = pnls.filter((p) => p < 0);
    const wins = winTrades.length;
    const losses = lossTrades.length;
    const winRate = (wins / totalTrades) * 100;

    const grossProfit = winTrades.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(lossTrades.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;

    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const bestTrade = Math.max(...pnls);
    const worstTrade = Math.min(...pnls);

    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

    const tradingDays = new Set(validTrades.map((t) => t.trade_date)).size;
    const avgPnlPerDay = tradingDays > 0 ? totalPnl / tradingDays : 0;

    // Streaks
    let longestWinStreak = 0;
    let longestLoseStreak = 0;
    let currentWin = 0;
    let currentLose = 0;
    const sortedPnls = [...validTrades]
      .sort((a, b) => ((a.trade_date ?? "") < (b.trade_date ?? "") ? -1 : 1))
      .map((t) => t.pnl as number);
    for (const p of sortedPnls) {
      if (p > 0) {
        currentWin++;
        currentLose = 0;
        longestWinStreak = Math.max(longestWinStreak, currentWin);
      } else if (p < 0) {
        currentLose++;
        currentWin = 0;
        longestLoseStreak = Math.max(longestLoseStreak, currentLose);
      }
    }

    // Max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    for (const p of sortedPnls) {
      cumulative += p;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
      totalTrades,
      totalPnl,
      wins,
      losses,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
      expectancy,
      avgRR,
      tradingDays,
      avgPnlPerDay,
      longestWinStreak,
      longestLoseStreak,
      maxDrawdown,
    };
  }, [trades]);

  // Daily PnL data (sorted chronologically)
  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      if (!t.trade_date || typeof t.pnl !== "number") continue;
      map.set(t.trade_date, (map.get(t.trade_date) ?? 0) + t.pnl);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, pnl]) => ({
        date: date.slice(5), // MM-DD
        pnl,
        fill: pnl >= 0 ? GREEN : RED,
      }));
  }, [trades]);

  // Cumulative PnL (equity curve)
  const equityCurve = useMemo(() => {
    let cum = 0;
    return dailyPnl.map((d) => {
      cum += d.pnl;
      return { date: d.date, cumulative: cum };
    });
  }, [dailyPnl]);

  // Win/Loss pie
  const winLossPie = useMemo(() => {
    if (stats.totalTrades === 0) return [];
    const be = stats.totalTrades - stats.wins - stats.losses;
    const data = [
      { name: "Wins", value: stats.wins, color: GREEN },
      { name: "Losses", value: stats.losses, color: RED },
    ];
    if (be > 0) data.push({ name: "Breakeven", value: be, color: "#64748b" });
    return data;
  }, [stats]);

  // PnL by Setup
  const setupBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const t of trades) {
      if (typeof t.pnl !== "number") continue;
      const key = t.setup || "No Setup";
      const cur = map.get(key) ?? { total: 0, count: 0 };
      cur.total += t.pnl;
      cur.count++;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, { total, count }]) => ({ name, total, count, avg: total / count }))
      .sort((a, b) => b.total - a.total);
  }, [trades]);

  // PnL by Emotion
  const emotionBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number; wins: number }>();
    for (const t of trades) {
      if (typeof t.pnl !== "number") continue;
      const key = t.emotion || "Unknown";
      const cur = map.get(key) ?? { total: 0, count: 0, wins: 0 };
      cur.total += t.pnl;
      cur.count++;
      if (t.pnl > 0) cur.wins++;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, { total, count, wins }]) => ({
        name,
        total,
        count,
        winRate: count > 0 ? (wins / count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [trades]);

  // PnL by Symbol
  const symbolBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number; wins: number }>();
    for (const t of trades) {
      if (typeof t.pnl !== "number") continue;
      const key = t.symbol || "Unknown";
      const cur = map.get(key) ?? { total: 0, count: 0, wins: 0 };
      cur.total += t.pnl;
      cur.count++;
      if (t.pnl > 0) cur.wins++;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, { total, count, wins }]) => ({
        name,
        total,
        count,
        winRate: count > 0 ? (wins / count) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [trades]);

  // Direction breakdown
  const directionData = useMemo(() => {
    const longs = trades.filter((t) => t.direction === "Long" && typeof t.pnl === "number");
    const shorts = trades.filter((t) => t.direction === "Short" && typeof t.pnl === "number");
    const longPnl = longs.reduce((a, t) => a + (t.pnl ?? 0), 0);
    const shortPnl = shorts.reduce((a, t) => a + (t.pnl ?? 0), 0);
    const longWins = longs.filter((t) => (t.pnl ?? 0) > 0).length;
    const shortWins = shorts.filter((t) => (t.pnl ?? 0) > 0).length;
    return [
      {
        name: "Long",
        count: longs.length,
        pnl: longPnl,
        winRate: longs.length > 0 ? (longWins / longs.length) * 100 : 0,
      },
      {
        name: "Short",
        count: shorts.length,
        pnl: shortPnl,
        winRate: shorts.length > 0 ? (shortWins / shorts.length) * 100 : 0,
      },
    ];
  }, [trades]);

  const monthLabel = (() => {
    const [y, m] = month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  })();

  if (stats.totalTrades === 0) {
    return (
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          Performance Dashboard — {monthLabel}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          No trades with PnL data for this month. Add trades to see analytics.
        </div>
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#1b2b45",
    border: "1px solid #233552",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15 }}>Performance Dashboard</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{monthLabel}</div>
        </div>

        {/* KPI Cards Row 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <KpiCard
            label="Net PnL"
            value={fmtPnl(stats.totalPnl)}
            color={stats.totalPnl >= 0 ? GREEN : RED}
            highlight
          />
          <KpiCard
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            color={stats.winRate >= 50 ? GREEN : RED}
            sub={`${stats.wins}W / ${stats.losses}L`}
          />
          <KpiCard
            label="Profit Factor"
            value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
            color={stats.profitFactor >= 1 ? GREEN : RED}
          />
          <KpiCard
            label="Expectancy"
            value={fmtPnl(stats.expectancy)}
            color={stats.expectancy >= 0 ? GREEN : RED}
            sub="per trade"
          />
          <KpiCard label="Total Trades" value={String(stats.totalTrades)} color={BLUE} />
          <KpiCard label="Trading Days" value={String(stats.tradingDays)} color={BLUE} />
        </div>

        {/* KPI Cards Row 2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          <KpiCard label="Avg Win" value={`+${fmt(stats.avgWin)}`} color={GREEN} />
          <KpiCard label="Avg Loss" value={`-${fmt(stats.avgLoss)}`} color={RED} />
          <KpiCard label="Avg R:R" value={stats.avgRR.toFixed(2)} color={stats.avgRR >= 1 ? GREEN : YELLOW} />
          <KpiCard label="Best Trade" value={fmtPnl(stats.bestTrade)} color={GREEN} />
          <KpiCard label="Worst Trade" value={fmtPnl(stats.worstTrade)} color={RED} />
          <KpiCard label="Max Drawdown" value={`-${fmt(stats.maxDrawdown)}`} color={RED} />
        </div>

        {/* Streak row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          <KpiCard label="Win Streak" value={String(stats.longestWinStreak)} color={GREEN} sub="longest" />
          <KpiCard label="Lose Streak" value={String(stats.longestLoseStreak)} color={RED} sub="longest" />
          <KpiCard
            label="Avg PnL/Day"
            value={fmtPnl(stats.avgPnlPerDay)}
            color={stats.avgPnlPerDay >= 0 ? GREEN : RED}
          />
        </div>
      </div>

      {/* Charts Row 1: Equity Curve + Daily PnL */}
      <div className="dash-grid-2">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Equity Curve</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9fb3d1" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9fb3d1" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke={BLUE}
                strokeWidth={2}
                dot={{ r: 3, fill: BLUE }}
                name="Cumulative PnL"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Daily PnL</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyPnl}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9fb3d1" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9fb3d1" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pnl" name="PnL" radius={[4, 4, 0, 0]}>
                {dailyPnl.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Win Rate Donut + PnL by Setup */}
      <div className="dash-grid-2">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Win / Loss Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={winLossPie}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {winLossPie.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>PnL by Setup</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={setupBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9fb3d1" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#9fb3d1" }} width={100} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="total" name="Total PnL" radius={[0, 4, 4, 0]}>
                {setupBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.total >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown Tables: Direction + Symbol + Emotion */}
      <div className="dash-grid-3">
        {/* Direction */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>By Direction</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={th}>Dir</th>
                <th style={th}>Trades</th>
                <th style={th}>PnL</th>
                <th style={th}>Win%</th>
              </tr>
            </thead>
            <tbody>
              {directionData.map((d) => (
                <tr key={d.name} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td}>{d.name}</td>
                  <td style={td}>{d.count}</td>
                  <td style={{ ...td, color: d.pnl >= 0 ? GREEN : RED, fontWeight: 600 }}>
                    {fmtPnl(d.pnl)}
                  </td>
                  <td style={{ ...td, color: d.winRate >= 50 ? GREEN : RED }}>
                    {d.winRate.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Symbol */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>By Symbol</div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>Symbol</th>
                  <th style={th}>Trades</th>
                  <th style={th}>PnL</th>
                  <th style={th}>Win%</th>
                </tr>
              </thead>
              <tbody>
                {symbolBreakdown.map((d) => (
                  <tr key={d.name} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{d.name}</td>
                    <td style={td}>{d.count}</td>
                    <td style={{ ...td, color: d.total >= 0 ? GREEN : RED, fontWeight: 600 }}>
                      {fmtPnl(d.total)}
                    </td>
                    <td style={{ ...td, color: d.winRate >= 50 ? GREEN : RED }}>
                      {d.winRate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Emotion */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>By Emotion</div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>Emotion</th>
                  <th style={th}>Trades</th>
                  <th style={th}>PnL</th>
                  <th style={th}>Win%</th>
                </tr>
              </thead>
              <tbody>
                {emotionBreakdown.map((d) => (
                  <tr key={d.name} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td}>{d.name}</td>
                    <td style={td}>{d.count}</td>
                    <td style={{ ...td, color: d.total >= 0 ? GREEN : RED, fontWeight: 600 }}>
                      {fmtPnl(d.total)}
                    </td>
                    <td style={{ ...td, color: d.winRate >= 50 ? GREEN : RED }}>
                      {d.winRate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dash-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .dash-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .dash-grid-3 {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .dash-grid-2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${highlight ? color + "40" : "var(--border)"}`,
        background: highlight ? color + "12" : "var(--cardSoft)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 11,
  fontWeight: 600,
  color: "#9fb3d1",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 13,
};
