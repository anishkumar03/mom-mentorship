"use client";

import { useState, useEffect } from "react";

/* ── 6 NON-NEGOTIABLE RULES ── */
const RULES = [
  "IFVG setups only",
  "Max $150 risk",
  "Max 2 trades",
  "1.5R target always",
  "Daily stop $300 → close",
  "No strategy switch",
];

/* ── MILESTONES ── */
const MILESTONES: Record<number, { label: string; message: string }> = {
  5:  { label: "MILESTONE 1", message: "5 days clean → You are building momentum." },
  10: { label: "MILESTONE 2", message: "10 days clean → Halfway. New pathways forming." },
  16: { label: "MILESTONE 3", message: "15 days clean → Payout territory. Trust the process." },
  20: { label: "MILESTONE 4", message: "20 days clean → DISCIPLINE MASTERED. You are the edge." },
};

interface DayData {
  rules: boolean[];
  pnl: string;
  trades: string;
  setupsMissed: string;
  feeling: string;
  date: string;
}

const emptyDay = (): DayData => ({
  rules: [false, false, false, false, false, false],
  pnl: "",
  trades: "",
  setupsMissed: "",
  feeling: "",
  date: "",
});

const STORAGE_KEY = "mom_discipline_streak";
const STREAK_START_KEY = "mom_discipline_streak_start";

export default function DisciplinePage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [streakStart, setStreakStart] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  /* load from localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const start = localStorage.getItem(STREAK_START_KEY);
      if (saved) setDays(JSON.parse(saved));
      else setDays(Array.from({ length: 20 }, emptyDay));
      if (start) setStreakStart(start);
    } catch {
      setDays(Array.from({ length: 20 }, emptyDay));
    }
    setLoaded(true);
  }, []);

  /* save to localStorage on change */
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
    if (streakStart) localStorage.setItem(STREAK_START_KEY, streakStart);
  }, [days, streakStart, loaded]);

  const updateDay = (idx: number, patch: Partial<DayData>) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const toggleRule = (dayIdx: number, ruleIdx: number) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, rules: d.rules.map((r, ri) => (ri === ruleIdx ? !r : r)) }
          : d
      )
    );
  };

  const isPerfect = (d: DayData) => d.rules.every(Boolean);
  const rulesFollowed = (d: DayData) => d.rules.filter(Boolean).length;

  const currentStreak = (() => {
    let streak = 0;
    for (let i = 0; i < days.length; i++) {
      if (isPerfect(days[i]) && days[i].rules.some(Boolean)) streak++;
      else break;
    }
    return streak;
  })();

  const resetStreak = () => {
    if (confirm("Reset the entire 20-day streak? This cannot be undone.")) {
      setDays(Array.from({ length: 20 }, emptyDay));
      setStreakStart("");
      localStorage.removeItem(STREAK_START_KEY);
    }
  };

  const startStreak = () => {
    const today = new Date().toISOString().slice(0, 10);
    setStreakStart(today);
  };

  if (!loaded) return null;

  /* ── STYLES ── */
  const page: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px 16px 100px",
  };

  const header: React.CSSProperties = {
    textAlign: "center",
    marginBottom: 24,
  };

  const rulesBar: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 6,
    marginBottom: 28,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const ruleBox: React.CSSProperties = {
    textAlign: "center",
    padding: "8px 4px",
    background: "#d4a017",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    color: "#000",
  };

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(380, 1fr))",
    gap: 14,
  };

  const dayCard = (d: DayData, dayNum: number): React.CSSProperties => {
    const milestone = MILESTONES[dayNum];
    const perfect = isPerfect(d) && d.rules.some(Boolean);
    return {
      border: milestone
        ? "2px solid #d4a017"
        : perfect
        ? "1px solid #22c55e"
        : "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: 14,
      background: milestone
        ? "rgba(212,160,23,0.08)"
        : perfect
        ? "rgba(34,197,94,0.06)"
        : "rgba(255,255,255,0.03)",
    };
  };

  const checkboxRow: React.CSSProperties = {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    margin: "8px 0",
  };

  const checkbox = (checked: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    border: checked ? "2px solid #d4a017" : "2px solid rgba(255,255,255,0.2)",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: checked ? "rgba(212,160,23,0.2)" : "transparent",
    fontSize: 14,
    fontWeight: 700,
    color: "#d4a017",
    transition: "all 0.15s",
  });

  const fieldRow: React.CSSProperties = {
    display: "flex",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  };

  const fieldInput: React.CSSProperties = {
    flex: 1,
    minWidth: 60,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    fontSize: 12,
  };

  const scoreTag = (count: number): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    marginTop: 6,
    background:
      count === 6
        ? "#22c55e"
        : count >= 5
        ? "#d4a017"
        : count >= 3
        ? "#f97316"
        : "#ef4444",
    color: count >= 5 ? "#000" : "#fff",
  });

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <div
          style={{
            height: 6,
            background: "linear-gradient(90deg, #d4a017, #f59e0b, #d4a017)",
            borderRadius: 3,
            marginBottom: 16,
          }}
        />
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1, margin: 0 }}>
          20-DAY DISCIPLINED STREAK
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          Mind Over Markets &nbsp;|&nbsp; IFVG Strategy &nbsp;|&nbsp; $150 Risk
          &nbsp;|&nbsp; 2 Trades Max &nbsp;|&nbsp; Copy Trade All Accounts
        </p>
        <p
          style={{
            color: "#d4a017",
            fontSize: 13,
            fontWeight: 600,
            marginTop: 8,
          }}
        >
          A perfect day = ALL 6 rules followed. Not the P&L. The RULES.
        </p>

        {/* Streak counter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 14,
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: currentStreak >= 20 ? "#22c55e" : currentStreak >= 10 ? "#d4a017" : "var(--text)",
            }}
          >
            {currentStreak}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Day Streak</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {currentStreak === 0
                ? "Start your streak today"
                : currentStreak >= 20
                ? "STREAK COMPLETE! You are the edge."
                : `${20 - currentStreak} days to go`}
            </div>
          </div>
        </div>

        {!streakStart && (
          <button
            onClick={startStreak}
            style={{
              marginTop: 12,
              padding: "8px 24px",
              background: "#d4a017",
              color: "#000",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Start My 20-Day Streak
          </button>
        )}
        {streakStart && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            Started: {streakStart} &nbsp;
            <button
              onClick={resetStreak}
              style={{
                background: "rgba(239,68,68,0.15)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Reset Streak
            </button>
          </div>
        )}
      </div>

      {/* 6 Rules Reference Bar */}
      <div style={rulesBar}>
        {RULES.map((r, i) => (
          <div key={i} style={ruleBox}>
            <div style={{ fontSize: 10, marginBottom: 2 }}>{r}</div>
            <div style={{ fontSize: 18 }}>{i + 1}</div>
          </div>
        ))}
      </div>

      {/* Day Cards Grid */}
      <div style={grid}>
        {days.map((d, idx) => {
          const dayNum = idx + 1;
          const milestone = MILESTONES[dayNum];
          const count = rulesFollowed(d);
          const perfect = isPerfect(d) && d.rules.some(Boolean);

          return (
            <div key={idx} style={dayCard(d, dayNum)}>
              {/* Day header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>DAY {dayNum}</span>
                  {perfect && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "#22c55e",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      PERFECT
                    </span>
                  )}
                </div>
                {d.date && (
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{d.date}</span>
                )}
              </div>

              {/* Milestone banner */}
              {milestone && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "4px 8px",
                    background: "rgba(212,160,23,0.15)",
                    borderRadius: 6,
                    borderLeft: "3px solid #d4a017",
                  }}
                >
                  <div style={{ color: "#d4a017", fontSize: 12, fontWeight: 700 }}>
                    {milestone.label}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>
                    {milestone.message}
                  </div>
                </div>
              )}

              {/* Rule checkboxes */}
              <div style={checkboxRow}>
                {d.rules.map((checked, ri) => (
                  <div
                    key={ri}
                    onClick={() => toggleRule(idx, ri)}
                    style={checkbox(checked)}
                    title={RULES[ri]}
                  >
                    {checked ? "✓" : ri + 1}
                  </div>
                ))}
              </div>

              {/* Score tag */}
              {d.rules.some(Boolean) && (
                <div>
                  <span style={scoreTag(count)}>
                    {count}/6 rules
                    {count === 6
                      ? " — PERFECT DAY"
                      : count >= 5
                      ? " — Good day"
                      : count >= 3
                      ? " — Needs work"
                      : " — Rule broken → streak resets"}
                  </span>
                </div>
              )}

              {/* Tracking fields */}
              <div style={fieldRow}>
                <input
                  style={fieldInput}
                  placeholder="P&L"
                  value={d.pnl}
                  onChange={(e) => updateDay(idx, { pnl: e.target.value })}
                />
                <input
                  style={fieldInput}
                  placeholder="Trades"
                  value={d.trades}
                  onChange={(e) => updateDay(idx, { trades: e.target.value })}
                />
              </div>
              <div style={fieldRow}>
                <input
                  style={fieldInput}
                  placeholder="Setups missed"
                  value={d.setupsMissed}
                  onChange={(e) => updateDay(idx, { setupsMissed: e.target.value })}
                />
                <input
                  style={fieldInput}
                  placeholder="Feeling"
                  value={d.feeling}
                  onChange={(e) => updateDay(idx, { feeling: e.target.value })}
                />
              </div>
              <input
                style={{ ...fieldInput, marginTop: 8, width: "auto" }}
                type="date"
                value={d.date}
                onChange={(e) => updateDay(idx, { date: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      {/* Streak Rules & Scoring Guide */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginTop: 28,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            STREAK RULES — NON NEGOTIABLE
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12 }}>All 6 rules followed = Perfect day ✓</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12 }}>Perfect day = streak continues</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: "#ef4444",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12 }}>Any rule broken = streak resets to Day 1</span>
          </div>
        </div>

        <div
          style={{
            background: "rgba(212,160,23,0.08)",
            border: "1px solid rgba(212,160,23,0.2)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            DAILY SCORING GUIDE
          </h3>
          {[
            { label: "6/6 rules", color: "#22c55e", text: "PERFECT DAY — streak continues ✓" },
            { label: "5/6 rules", color: "#d4a017", text: "Good day — identify what broke" },
            { label: "3-4/6 rules", color: "#f97316", text: "Needs work — journal it" },
            { label: "0-2/6 rules", color: "#ef4444", text: "Streak broken — reset & reflect" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  background: s.color,
                  color: s.color === "#d4a017" || s.color === "#22c55e" ? "#000" : "#fff",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
