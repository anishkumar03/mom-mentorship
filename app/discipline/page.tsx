"use client";

import { useState, useEffect } from "react";

/* ── CONFIGURATION OPTIONS ── */
const STREAK_LENGTH_OPTIONS = [5, 10, 15, 20, 30];
const MAX_RISK_OPTIONS = [50, 100, 150, 200, 250, 300];
const MAX_TRADES_OPTIONS = [1, 2, 3, 4, 5];
const R_TARGET_OPTIONS = ["1 to 1.5", "1 to 2", "1.5 to 2", "2 to 2.5", "2 to 3"];
const DAILY_STOP_OPTIONS = ["250 to 300", "300 to 350", "350 to 400", "400 to 500"];

/* ── STREAK CONFIG ── */
interface StreakConfig {
  streakDays: number;
  maxRisk: number;
  maxTrades: number;
  rTarget: string;
  dailyStop: string;
}

const DEFAULT_CONFIG: StreakConfig = {
  streakDays: 20,
  maxRisk: 150,
  maxTrades: 2,
  rTarget: "1 to 1.5",
  dailyStop: "300 to 350",
};

/* ── BUILD RULES FROM CONFIG ── */
function buildRules(config: StreakConfig): string[] {
  return [
    "IFVG setups only",
    `Max $${config.maxRisk} risk`,
    `Max ${config.maxTrades} trades`,
    `${config.rTarget}R target`,
    `Daily stop $${config.dailyStop} → close`,
    "No strategy switch",
  ];
}

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
const STREAK_CONFIG_KEY = "mom_discipline_streak_config";

export default function DisciplinePage() {
  const [days, setDays] = useState<DayData[]>([]);
  const [streakStart, setStreakStart] = useState<string>("");
  const [config, setConfig] = useState<StreakConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  /* load from localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const start = localStorage.getItem(STREAK_START_KEY);
      const savedConfig = localStorage.getItem(STREAK_CONFIG_KEY);

      if (savedConfig) {
        const parsed = JSON.parse(savedConfig) as StreakConfig;
        setConfig(parsed);
        if (saved) setDays(JSON.parse(saved));
        else setDays(Array.from({ length: parsed.streakDays }, emptyDay));
      } else {
        if (saved) setDays(JSON.parse(saved));
        else setDays(Array.from({ length: DEFAULT_CONFIG.streakDays }, emptyDay));
      }

      if (start) setStreakStart(start);
    } catch {
      setDays(Array.from({ length: config.streakDays }, emptyDay));
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* save to localStorage on change */
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
    localStorage.setItem(STREAK_CONFIG_KEY, JSON.stringify(config));
    if (streakStart) localStorage.setItem(STREAK_START_KEY, streakStart);
  }, [days, streakStart, config, loaded]);

  const isStreakActive = !!streakStart;
  const RULES = buildRules(config);

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

  const milestones: Record<number, { label: string; message: string }> = {};
  const total = config.streakDays;
  if (total >= 5) milestones[5] = { label: "MILESTONE 1", message: "5 days clean → You are building momentum." };
  if (total >= 10) milestones[10] = { label: "MILESTONE 2", message: "10 days clean → New pathways forming." };
  if (total >= 15) milestones[15] = { label: "MILESTONE 3", message: "15 days clean → Payout territory. Trust the process." };
  if (total >= 20) milestones[20] = { label: "MILESTONE 4", message: "20 days clean → DISCIPLINE MASTERED. You are the edge." };

  const resetStreak = () => {
    if (confirm("Reset the entire streak? This cannot be undone.")) {
      setDays(Array.from({ length: config.streakDays }, emptyDay));
      setStreakStart("");
      localStorage.removeItem(STREAK_START_KEY);
      localStorage.removeItem(STREAK_CONFIG_KEY);
      setConfig(DEFAULT_CONFIG);
    }
  };

  const startStreak = () => {
    const today = new Date().toISOString().slice(0, 10);
    setStreakStart(today);
    setDays(Array.from({ length: config.streakDays }, emptyDay));
  };

  const updateConfig = (patch: Partial<StreakConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      if (patch.streakDays && patch.streakDays !== prev.streakDays) {
        setDays(Array.from({ length: patch.streakDays }, emptyDay));
      }
      return next;
    });
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
    gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
    gap: 14,
  };

  const dayCard = (d: DayData, dayNum: number): React.CSSProperties => {
    const milestone = milestones[dayNum];
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

  const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid rgba(212,160,23,0.4)",
    background: "rgba(212,160,23,0.1)",
    color: "#d4a017",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
  };

  const selectDisabled: React.CSSProperties = {
    ...selectStyle,
    opacity: 0.6,
    cursor: "not-allowed",
    background: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "var(--muted)",
  };

  const configLabel: React.CSSProperties = {
    fontSize: 11,
    color: "var(--muted)",
    marginBottom: 4,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

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
          {config.streakDays}-DAY DISCIPLINED STREAK
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
          Mind Over Markets &nbsp;|&nbsp; IFVG Strategy &nbsp;|&nbsp; ${config.maxRisk} Risk
          &nbsp;|&nbsp; {config.maxTrades} Trades Max &nbsp;|&nbsp; Copy Trade All Accounts
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
              color:
                currentStreak >= config.streakDays
                  ? "#22c55e"
                  : currentStreak >= Math.floor(config.streakDays / 2)
                  ? "#d4a017"
                  : "var(--text)",
            }}
          >
            {currentStreak}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Day Streak</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {currentStreak === 0
                ? "Start your streak today"
                : currentStreak >= config.streakDays
                ? "STREAK COMPLETE! You are the edge."
                : `${config.streakDays - currentStreak} days to go`}
            </div>
          </div>
        </div>
      </div>

      {/* ── STREAK BUILDER / CONFIG PANEL ── */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: isStreakActive
            ? "rgba(255,255,255,0.03)"
            : "rgba(212,160,23,0.06)",
          border: isStreakActive
            ? "1px solid rgba(255,255,255,0.08)"
            : "2px solid rgba(212,160,23,0.3)",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              color: isStreakActive ? "var(--muted)" : "#d4a017",
            }}
          >
            {isStreakActive ? "STREAK PARAMETERS (LOCKED)" : "BUILD YOUR STREAK"}
          </h2>
          {isStreakActive && (
            <span
              style={{
                fontSize: 11,
                color: "var(--muted)",
                background: "rgba(255,255,255,0.06)",
                padding: "3px 10px",
                borderRadius: 4,
              }}
            >
              Started: {streakStart}
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {/* Streak Days */}
          <div>
            <div style={configLabel}>Streak Days</div>
            <select
              style={isStreakActive ? selectDisabled : selectStyle}
              value={config.streakDays}
              disabled={isStreakActive}
              onChange={(e) => updateConfig({ streakDays: Number(e.target.value) })}
            >
              {STREAK_LENGTH_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}-Day Streak
                </option>
              ))}
            </select>
          </div>

          {/* Max Risk */}
          <div>
            <div style={configLabel}>Max Risk</div>
            <select
              style={isStreakActive ? selectDisabled : selectStyle}
              value={config.maxRisk}
              disabled={isStreakActive}
              onChange={(e) => updateConfig({ maxRisk: Number(e.target.value) })}
            >
              {MAX_RISK_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  ${v}
                </option>
              ))}
            </select>
          </div>

          {/* Max Trades */}
          <div>
            <div style={configLabel}>Max Trades</div>
            <select
              style={isStreakActive ? selectDisabled : selectStyle}
              value={config.maxTrades}
              disabled={isStreakActive}
              onChange={(e) => updateConfig({ maxTrades: Number(e.target.value) })}
            >
              {MAX_TRADES_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v} Trade{v > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* R Target */}
          <div>
            <div style={configLabel}>R Target</div>
            <select
              style={isStreakActive ? selectDisabled : selectStyle}
              value={config.rTarget}
              disabled={isStreakActive}
              onChange={(e) => updateConfig({ rTarget: e.target.value })}
            >
              {R_TARGET_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}R
                </option>
              ))}
            </select>
          </div>

          {/* Daily Stop */}
          <div>
            <div style={configLabel}>Daily Stop</div>
            <select
              style={isStreakActive ? selectDisabled : selectStyle}
              value={config.dailyStop}
              disabled={isStreakActive}
              onChange={(e) => updateConfig({ dailyStop: e.target.value })}
            >
              {DAILY_STOP_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  ${v}
                </option>
              ))}
            </select>
          </div>

          {/* No Strategy Switch — fixed */}
          <div>
            <div style={configLabel}>Strategy</div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--muted)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              No strategy switch
            </div>
          </div>
        </div>

        {/* Start / Reset buttons */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          {!isStreakActive ? (
            <button
              onClick={startStreak}
              style={{
                padding: "10px 32px",
                background: "#d4a017",
                color: "#000",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              Start My {config.streakDays}-Day Streak
            </button>
          ) : (
            <button
              onClick={resetStreak}
              style={{
                background: "rgba(239,68,68,0.15)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 6,
                padding: "6px 16px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Reset Streak
            </button>
          )}
        </div>
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
          const milestone = milestones[dayNum];
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
