"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, Italic, Code, List, ListOrdered, CheckSquare, Calendar } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Trade = {
  id: string;
  created_at: string | null;
  trade_date: string;
  symbol: string | null;
  setup: string | null;
  emotion: string | null;
  entry_price: number | null;
  entry_time: string | null;
  exit_time: string | null;
  pnl: number | null;
  notes: string | null;
  screenshot_url: string | null;
  archived: boolean | null;
};

const COMMON_SETUPS = ["ICT FVG", "Unicorn", "Breaker", "Liquidity Sweep"] as const;
const EMOTIONS = [
  "Calm",
  "Confident",
  "Anxious",
  "Fear",
  "FOMO",
  "Revenge",
  "Overconfident",
  "Frustrated",
  "Neutral",
  "Focused",
  "Distracted",
  "Other"
] as const;

const DEFAULT_TRADE_DATE = "2026-02-25";
const DEFAULT_MONTH = "2026-02";

function toTimeInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOFromDateAndTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null;
  const d = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function truncatePreview(text: string, max = 120) {
  const v = text.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1).trimEnd()}…`;
}

function toDateLabel(dateString: string) {
  const d = new Date(dateString + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString();
}

function toTimeLabel(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function monthRange(monthValue: string) {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return { start: DEFAULT_TRADE_DATE, end: DEFAULT_TRADE_DATE };
  }
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return { start: startStr, end: endStr };
}

function buildMonthDays(monthValue: string) {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = first.getDay();
  const totalSlots = Math.ceil((offset + daysInMonth) / 7) * 7;
  const days: Array<{ key: string | null; day: number | null }> = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let i = 0; i < totalSlots; i += 1) {
    const dayNum = i - offset + 1;
    if (dayNum <= 0 || dayNum > daysInMonth) {
      days.push({ key: null, day: null });
    } else {
      const key = `${year}-${pad(monthIndex + 1)}-${pad(dayNum)}`;
      days.push({ key, day: dayNum });
    }
  }
  return days;
}

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [setupFilter, setSetupFilter] = useState("__ALL__");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tradeDate, setTradeDate] = useState(DEFAULT_TRADE_DATE);
  const [symbol, setSymbol] = useState("");
  const [setupValue, setSetupValue] = useState("");
  const [emotionOption, setEmotionOption] = useState<(typeof EMOTIONS)[number]>("Neutral");
  const [emotionCustom, setEmotionCustom] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [pnl, setPnl] = useState("");
  const [notes, setNotes] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testPlanHtml, setTestPlanHtml] = useState("");
  const testPlanRef = useRef<HTMLDivElement | null>(null);

  const fetchTrades = async (monthValue: string) => {
    setLoading(true);
    setErrorBanner(null);
    const range = monthRange(monthValue);
    const { data, error } = await supabase
      .from("trade_journal")
      .select("*")
      .gte("trade_date", range.start)
      .lte("trade_date", range.end)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setTrades([]);
      setErrorBanner(
        error.message.includes("trade_journal")
          ? "Trade journal table is unavailable. Run the migration for trade_journal."
          : error.message
      );
      setLoading(false);
      return;
    }

    setTrades((data ?? []) as Trade[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades(month);
  }, [month]);

  useEffect(() => {
    if (selectedDay && !selectedDay.startsWith(month)) {
      setSelectedDay(null);
    }
  }, [month, selectedDay]);

  useEffect(() => {
    return () => {
      if (screenshotPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("journal_test_plan_html") : null;
    setTestPlanHtml(saved ?? "");
  }, []);

  useEffect(() => {
    const el = testPlanRef.current;
    if (el && el.innerHTML !== testPlanHtml) {
      el.innerHTML = testPlanHtml;
    }
  }, [testPlanHtml]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("journal_test_plan_html", testPlanHtml);
    }
  }, [testPlanHtml]);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (selectedDay && t.trade_date !== selectedDay) return false;
      if (symbolFilter.trim()) {
        const sym = (t.symbol ?? "").toLowerCase();
        if (!sym.includes(symbolFilter.trim().toLowerCase())) return false;
      }
      if (setupFilter !== "__ALL__" && (t.setup ?? "") !== setupFilter) return false;
      return true;
    });
  }, [trades, selectedDay, symbolFilter, setupFilter]);

  const setupFilterOptions = useMemo(() => {
    const values = new Set<string>();
    COMMON_SETUPS.forEach((s) => values.add(s));
    trades.forEach((t) => {
      if (t.setup) values.add(t.setup);
    });
    return Array.from(values);
  }, [trades]);

  const setupOptions = useMemo(() => {
    const values = new Set<string>();
    COMMON_SETUPS.forEach((s) => values.add(s));
    trades.forEach((t) => {
      if (t.setup) values.add(t.setup);
    });
    return Array.from(values);
  }, [trades]);

  const dayStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number; symbols: string[] }>();
    for (const t of trades) {
      const key = t.trade_date;
      const current = map.get(key) ?? { total: 0, count: 0, symbols: [] };
      const pnlValue = typeof t.pnl === "number" ? t.pnl : 0;
      current.total += pnlValue;
      current.count += 1;
      if (t.symbol && !current.symbols.includes(t.symbol)) current.symbols.push(t.symbol);
      map.set(key, current);
    }
    return map;
  }, [trades]);

  const resetForm = () => {
    setEditingId(null);
    setTradeDate(DEFAULT_TRADE_DATE);
    setSymbol("");
    setSetupValue("");
    setEmotionOption("Neutral");
    setEmotionCustom("");
    setEntryPrice("");
    setEntryTime("");
    setExitTime("");
    setPnl("");
    setNotes("");
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const onScreenshotChange = (file: File | null) => {
    if (screenshotPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshotFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setScreenshotPreview(url);
    } else {
      setScreenshotPreview(null);
    }
  };

  const uploadScreenshot = async (file: File, dateValue: string) => {
    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, "_");
    const path = `${dateValue}/${Date.now()}_${safeName}`;
    const { error } = await supabase
      .storage
      .from("journal_screenshots")
      .upload(path, file, { upsert: false });
    if (error) {
      throw new Error(error.message);
    }
    const { data } = supabase.storage.from("journal_screenshots").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveTrade = async () => {
    setIsSaving(true);
    setErrorBanner(null);
    try {
      if (!tradeDate) {
        setErrorBanner("Trade date is required.");
        setIsSaving(false);
        return;
      }

      const resolvedSetup = setupValue.trim() ? setupValue.trim() : null;
      const resolvedEmotion =
        emotionOption === "Other" ? (emotionCustom.trim() ? emotionCustom.trim() : null) : emotionOption;
      const payload: any = {
        trade_date: tradeDate,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : null,
        setup: resolvedSetup,
        emotion: resolvedEmotion,
        entry_price: entryPrice.trim() ? Number(entryPrice) : null,
        entry_time: toISOFromDateAndTime(tradeDate, entryTime),
        exit_time: toISOFromDateAndTime(tradeDate, exitTime),
        pnl: pnl.trim() ? Number(pnl) : null,
        notes: notes.trim() ? notes.trim() : null
      };

      if (payload.entry_price !== null && Number.isNaN(payload.entry_price)) payload.entry_price = null;
      if (payload.pnl !== null && Number.isNaN(payload.pnl)) payload.pnl = null;

      if (screenshotFile) {
        try {
          const url = await uploadScreenshot(screenshotFile, tradeDate);
          payload.screenshot_url = url;
        } catch (err: any) {
          setErrorBanner(
            err?.message?.includes("bucket")
              ? "Screenshot bucket is missing. Create journal_screenshots in Supabase Storage."
              : `Screenshot upload failed: ${err?.message ?? "Unknown error"}`
          );
          setIsSaving(false);
          return;
        }
      } else if (editingId && screenshotPreview && !screenshotPreview.startsWith("blob:")) {
        payload.screenshot_url = screenshotPreview;
      }

      let res;
      if (editingId) {
        res = await supabase.from("trade_journal").update(payload).eq("id", editingId);
      } else {
        res = await supabase.from("trade_journal").insert(payload);
      }

      if (res.error) {
        setErrorBanner(res.error.message);
        setIsSaving(false);
        return;
      }

      resetForm();
      fetchTrades(month);
    } finally {
      setIsSaving(false);
    }
  };

  const loadEdit = (t: Trade) => {
    setEditingId(t.id);
    setTradeDate(t.trade_date || DEFAULT_TRADE_DATE);
    setSymbol((t.symbol ?? "") as string);
    setSetupValue((t.setup ?? "") as string);
    const hasEmotion = t.emotion && EMOTIONS.includes(t.emotion as any);
    if (hasEmotion) {
      setEmotionOption(t.emotion as (typeof EMOTIONS)[number]);
      setEmotionCustom("");
    } else if (t.emotion) {
      setEmotionOption("Other");
      setEmotionCustom(t.emotion ?? "");
    } else {
      setEmotionOption("Neutral");
      setEmotionCustom("");
    }
    setEntryPrice(t.entry_price !== null && t.entry_price !== undefined ? String(t.entry_price) : "");
    setEntryTime(toTimeInputValue(t.entry_time));
    setExitTime(toTimeInputValue(t.exit_time));
    setPnl(t.pnl !== null && t.pnl !== undefined ? String(t.pnl) : "");
    setNotes((t.notes ?? "") as string);
    setScreenshotFile(null);
    setScreenshotPreview(t.screenshot_url ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteTrade = async (t: Trade) => {
    const ok = confirm("Delete this trade? This cannot be undone.");
    if (!ok) return;
    const { error } = await supabase.from("trade_journal").delete().eq("id", t.id);
    if (error) {
      setErrorBanner(error.message);
      return;
    }
    fetchTrades(month);
  };

  const exportCsv = () => {
    const rows = trades;
    const headers = [
      "trade_date",
      "symbol",
      "setup",
      "emotion",
      "entry_price",
      "entry_time",
      "exit_time",
      "pnl",
      "notes",
      "screenshot_url"
    ];
    const lines = [headers.join(",")];
    for (const t of rows) {
      const values = [
        t.trade_date,
        t.symbol ?? "",
        t.setup ?? "",
        t.emotion ?? "",
        t.entry_price ?? "",
        t.entry_time ?? "",
        t.exit_time ?? "",
        t.pnl ?? "",
        (t.notes ?? "").replace(/\n/g, " ").replace(/"/g, '""'),
        t.screenshot_url ?? ""
      ];
      const line = values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
      lines.push(line);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade_journal_${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const monthDays = useMemo(() => buildMonthDays(month), [month]);

  const syncTestPlanHtml = () => {
    const el = testPlanRef.current;
    if (!el) return;
    setTestPlanHtml(el.innerHTML);
  };

  const exec = (command: string) => {
    const el = testPlanRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command);
    syncTestPlanHtml();
  };

  const wrapSelectionWithCode = () => {
    const el = testPlanRef.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const code = document.createElement("code");
    if (selection.isCollapsed) {
      code.textContent = "code";
      range.insertNode(code);
      range.setStart(code.firstChild || code, 0);
      range.setEnd(code.firstChild || code, code.textContent?.length ?? 0);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      const contents = range.extractContents();
      code.appendChild(contents);
      range.insertNode(code);
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    syncTestPlanHtml();
  };

  const insertChecklistItem = () => {
    const el = testPlanRef.current;
    if (!el) return;
    el.focus();
    document.execCommand("insertHTML", false, "<br>- [ ] ");
    syncTestPlanHtml();
  };

  const insertDateStamp = () => {
    const el = testPlanRef.current;
    if (!el) return;
    el.focus();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(stamp);
    range.insertNode(textNode);
    range.setStart(textNode, textNode.length);
    range.setEnd(textNode, textNode.length);
    selection.removeAllRanges();
    selection.addRange(range);
    syncTestPlanHtml();
  };


  const pnlBadge = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "—";
    const sign = value > 0 ? "+" : value < 0 ? "" : "";
    return `${sign}${value}`;
  };

  return (
    <div style={page}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Trading Journal</h2>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Log trades, patterns, and emotions to refine your edge.</div>
        </div>
        <button onClick={exportCsv} style={btnSecondary}>Export CSV</button>
      </div>

      {errorBanner && (
        <div style={errorBannerStyle}>{errorBanner}</div>
      )}

      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Trade Plan</h3>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="flex gap-2 text-slate-200 [&_button]:inline-flex [&_button]:items-center [&_button]:justify-center [&_button]:w-9 [&_button]:h-9 [&_button]:rounded-md [&_button]:border [&_button]:border-white/10 [&_button]:bg-white/5 [&_button]:hover:bg-white/10 [&_button]:text-slate-200 [&_button]:focus:outline-none [&_button]:focus:ring-2 [&_button]:focus:ring-blue-500/40 [&_svg]:block [&_svg]:w-5 [&_svg]:h-5 [&_svg]:text-slate-200 [&_svg]:stroke-current [&_svg]:opacity-100">
            <button onClick={() => exec("bold")} title="Bold" aria-label="Bold">
              <Bold size={18} color="#E2E8F0" className="block text-slate-200 opacity-100" />
            </button>
            <button onClick={() => exec("italic")} title="Italic" aria-label="Italic">
              <Italic size={18} color="#E2E8F0" className="block text-slate-200 opacity-100" />
            </button>
            <button onClick={wrapSelectionWithCode} title="Code" aria-label="Code">
              <Code size={18} color="#E2E8F0" className="block text-slate-200 opacity-100" />
            </button>
            <button onClick={() => exec("insertUnorderedList")} title="Bullet List" aria-label="Bullet List">
              <List size={18} color="#E2E8F0" className="block text-slate-200 opacity-100" />
            </button>
            <button onClick={() => exec("insertOrderedList")} title="Numbered List" aria-label="Numbered List">
              <ListOrdered size={18} color="#E2E8F0" className="block text-slate-200 opacity-100" />
            </button>
            <button onClick={insertChecklistItem} title="Checklist" aria-label="Checklist">
              <CheckSquare size={18} color="#E2E8F0" className="block text-slate-200 opacity-100" />
            </button>
            <button onClick={insertDateStamp} title="Date" aria-label="Date">
              <Calendar size={18} color="#E2E8F0" className="block text-slate-200 opacity-100" />
            </button>
          </div>
          <div
            ref={testPlanRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncTestPlanHtml}
            style={{
              ...input,
              width: "100%",
              minHeight: 140,
              resize: "vertical",
              fontFamily: "inherit",
              outline: "none",
              whiteSpace: "pre-wrap",
              overflow: "auto"
            }}
          />
          <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
            Formatting applies to the selected text.
          </div>
        </div>
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0 }}>{editingId ? "Edit Trade" : "Add Trade"}</h3>
          {editingId && (
            <div style={{ fontSize: 12, opacity: 0.85 }}>Editing trade {editingId.slice(0, 8)}...</div>
          )}
        </div>

        <div className="journal-grid">
          <div>
            <label style={label}>Trade date</label>
            <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Symbol (optional)</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Setup</label>
            <input
              list="setup-options"
              value={setupValue}
              onChange={(e) => setSetupValue(e.target.value)}
              style={input}
              placeholder="Start typing..."
            />
            <datalist id="setup-options">
              {setupOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label style={label}>Emotion</label>
            <select
              value={emotionOption}
              onChange={(e) => setEmotionOption(e.target.value as any)}
              style={input}
            >
              {EMOTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {emotionOption === "Other" && (
            <div>
              <label style={label}>Custom emotion</label>
              <input value={emotionCustom} onChange={(e) => setEmotionCustom(e.target.value)} style={input} />
            </div>
          )}

          <div>
            <label style={label}>Entry price</label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>Entry time</label>
            <input
              type="time"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>Exit time</label>
            <input
              type="time"
              value={exitTime}
              onChange={(e) => setExitTime(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>PnL</label>
            <input
              type="number"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              style={{
                ...input,
                color: pnl.trim() ? (Number(pnl) >= 0 ? "#7CFF7C" : "#FF7A7A") : "white"
              }}
            />
          </div>

          <div className="journal-notes">
            <label style={label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...input, width: "100%", minHeight: 110, resize: "vertical" }}
            />
          </div>

          <div>
            <label style={label}>Screenshot</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onScreenshotChange(e.target.files?.[0] ?? null)}
              style={input}
            />
            {screenshotPreview && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  style={{ width: 140, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="journal-buttons">
          <button onClick={saveTrade} style={btnPrimary} disabled={isSaving}>
            {isSaving ? "Saving..." : editingId ? "Update Trade" : "Save Trade"}
          </button>
          <button onClick={resetForm} style={btnSecondary}>Clear</button>
        </div>
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Month Snapshot</h3>
          <div style={{ opacity: 0.8 }}>{month}</div>
        </div>

        <div className="journal-filters">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.85 }}>Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={inputSmall}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.85 }}>Symbol</span>
            <input
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              style={inputSmall}
              placeholder="All"
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.85 }}>Setup</span>
            <select value={setupFilter} onChange={(e) => setSetupFilter(e.target.value)} style={inputSmall}>
              <option value="__ALL__">All</option>
              {setupFilterOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: "auto", opacity: 0.85 }}>
            {loading ? "Loading..." : `No. of trades: ${filteredTrades.length}`}
          </div>
        </div>

        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} style={{ fontSize: 12, opacity: 0.7, textAlign: "center" }}>{d}</div>
          ))}
          {monthDays.map((d, idx) => {
            if (!d.key || !d.day) {
              return <div key={`empty-${idx}`} style={calendarCellEmpty} />;
            }
            const stats = dayStats.get(d.key);
            const pnlTotal = stats?.total ?? 0;
            const isSelected = selectedDay === d.key;
            const isDefaultHighlight = month === "2026-02" && d.day === 25;
            return (
              <button
                key={d.key}
                onClick={() => setSelectedDay(d.key)}
                style={{
                  ...calendarCell,
                  borderColor: isSelected ? "var(--accent)" : "rgba(255,255,255,0.08)",
                  background: isSelected ? "rgba(79, 163, 255, 0.12)" : "rgba(255,255,255,0.03)"
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: isDefaultHighlight ? "#7CFF7C" : "white" }}>
                  {d.day}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: pnlTotal >= 0 ? "#7CFF7C" : "#FF7A7A",
                    marginTop: 6
                  }}
                >
                  {stats ? pnlBadge(pnlTotal) : "—"}
                </div>
                {stats && (
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>
                    {stats.count} trade{stats.count > 1 ? "s" : ""}
                  </div>
                )}
                {stats?.symbols?.length ? (
                  <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                    {stats.symbols.slice(0, 3).join(", ")}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0 }}>
            {selectedDay ? `Trades on ${toDateLabel(selectedDay)}` : "Trades for Selected Month"}
          </h3>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} style={btnSecondary}>Clear day filter</button>
          )}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {filteredTrades.map((t) => (
            <div key={t.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>
                    {toDateLabel(t.trade_date)}{t.symbol ? ` • ${t.symbol}` : ""}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    {t.setup ?? "—"} • {t.emotion ?? "—"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                    Entry: {toTimeLabel(t.entry_time)} • Exit: {toTimeLabel(t.exit_time)}
                  </div>
                  {t.notes && (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      {truncatePreview(t.notes)}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div
                    style={{
                      ...badge,
                      background:
                        t.pnl === null || Number.isNaN(t.pnl)
                          ? "rgba(255,255,255,0.08)"
                          : t.pnl >= 0
                            ? "rgba(38, 208, 124, 0.18)"
                            : "rgba(255, 99, 99, 0.2)",
                      color: t.pnl === null || Number.isNaN(t.pnl) ? "white" : t.pnl >= 0 ? "#7CFF7C" : "#FF7A7A"
                    }}
                  >
                    {pnlBadge(t.pnl)}
                  </div>

                  {t.screenshot_url && (
                    <a href={t.screenshot_url} target="_blank" rel="noreferrer">
                      <img
                        src={t.screenshot_url}
                        alt="Trade screenshot"
                        style={{
                          width: 70,
                          height: 50,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid rgba(255,255,255,0.12)"
                        }}
                      />
                    </a>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => loadEdit(t)} style={btnSecondary}>Edit</button>
                    <button onClick={() => deleteTrade(t)} style={btnDanger}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredTrades.length === 0 && (
            <div style={{ opacity: 0.8 }}>
              {selectedDay ? "No trades logged for this day yet." : "No trades logged for this month yet."}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .journal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
        .journal-notes {
          grid-column: span 2;
        }
        .journal-buttons {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .journal-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(90px, 1fr));
          gap: 8px;
          margin-top: 12px;
        }
        @media (max-width: 720px) {
          .journal-notes {
            grid-column: span 1;
          }
          .journal-buttons button {
            width: 100%;
          }
          .calendar-grid {
            grid-template-columns: repeat(7, minmax(44px, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1150,
  margin: "20px auto",
  padding: 12,
  color: "white",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  background: "linear-gradient(180deg, #071427 0%, #061122 100%)",
  minHeight: "100vh"
};

const panel: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)"
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 6
};

const input: React.CSSProperties = {
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  width: "100%"
};

const inputSmall: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.25)",
  color: "white"
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#1f4fff",
  color: "white",
  cursor: "pointer",
  textDecoration: "none"
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  cursor: "pointer"
};

const btnDanger: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#ff3b30",
  color: "white",
  cursor: "pointer"
};

const linkButton: React.CSSProperties = {
  marginLeft: 6,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#9ec6ff",
  cursor: "pointer",
  textDecoration: "underline"
};

const badge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 12,
  minWidth: 60,
  textAlign: "center"
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(255,255,255,0.03)"
};

const errorBannerStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(255, 99, 99, 0.5)",
  background: "rgba(255, 99, 99, 0.12)",
  color: "#ffd1d1"
};

const calendarCell: React.CSSProperties = {
  padding: 8,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  textAlign: "left",
  minHeight: 72,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start"
};

const calendarCellEmpty: React.CSSProperties = {
  minHeight: 72,
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.02)"
};
