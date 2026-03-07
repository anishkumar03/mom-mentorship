"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, Italic, Code, List, ListOrdered, CheckSquare, Calendar } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

const JournalDashboard = dynamic(() => import("./JournalDashboard"), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Trade = {
  id: string;
  created_at: string | null;
  trade_date: string | null;
  firm_id: string | null;
  account_id: string | null;
  symbol: string | null;
  direction: string | null;
  contracts: number | null;
  setup: string | null;
  emotion: string | null;
  entry_price: number | null;
  exit_price: number | null;
  entry_time: string | null;
  exit_time: string | null;
  pnl: number | null;
  notes: string | null;
  screenshot_url: string | null;
  screenshot_path: string | null;
  archived: boolean | null;
};

type Firm = {
  id: string;
  name: string;
  platform: string | null;
  firm_type: "prop" | "personal";
};

type Account = {
  id: string;
  firm_id: string;
  name: string;
  account_size: string | null;
  account_type: string | null;
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

function todayStr() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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
    return { start: todayStr(), end: todayStr() };
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
  const [firms, setFirms] = useState<Firm[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [month, setMonth] = useState(() => currentMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [setupFilter, setSetupFilter] = useState("__ALL__");
  const [firmFilter, setFirmFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [firmTypeFilter, setFirmTypeFilter] = useState<"all" | "prop" | "personal">("all");
  const [winLossFilter, setWinLossFilter] = useState<"all" | "win" | "loss">("all");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tradeDate, setTradeDate] = useState(() => todayStr());
  const [firmId, setFirmId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"Long" | "Short">("Long");
  const [contracts, setContracts] = useState("");
  const [setupValue, setSetupValue] = useState("");
  const [newSetupValue, setNewSetupValue] = useState("");
  const [customSetups, setCustomSetups] = useState<string[]>([]);
  const [emotionOption, setEmotionOption] = useState<(typeof EMOTIONS)[number]>("Neutral");
  const [emotionCustom, setEmotionCustom] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [pnl, setPnl] = useState("");
  const [notes, setNotes] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [firmModalOpen, setFirmModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [newFirmPlatform, setNewFirmPlatform] = useState("");
  const [newFirmType, setNewFirmType] = useState<"prop" | "personal">("prop");
  const [newAccountFirmId, setNewAccountFirmId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountSize, setNewAccountSize] = useState("");
  const [newAccountType, setNewAccountType] = useState("eval");
  const [customAccountSizes, setCustomAccountSizes] = useState<string[]>([]);
  const [testPlanHtml, setTestPlanHtml] = useState("");
  const testPlanRef = useRef<HTMLDivElement | null>(null);

  const fetchTrades = async (monthValue: string) => {
    setLoading(true);
    setErrorBanner(null);
    const range = monthRange(monthValue);
    const [tradeRes, firmRes, accountRes] = await Promise.all([
      supabase
        .from("trade_journal")
        .select("*")
        .gte("trade_date", range.start)
        .lte("trade_date", range.end)
        .order("trade_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("prop_firms")
        .select("id,name,platform,firm_type")
        .order("created_at", { ascending: true }),
      supabase
        .from("prop_accounts")
        .select("id,firm_id,name,account_size,account_type")
        .order("created_at", { ascending: true })
    ]);

    if (tradeRes.error) {
      console.error(tradeRes.error);
      setTrades([]);
      setErrorBanner(
        tradeRes.error.message.includes("trade_journal")
          ? "Trade journal table is unavailable. Run the migration for trade_journal."
          : tradeRes.error.message
      );
      setLoading(false);
      return;
    }
    if (firmRes.error) {
      setErrorBanner(firmRes.error.message);
      setLoading(false);
      return;
    }
    if (accountRes.error) {
      setErrorBanner(accountRes.error.message);
      setLoading(false);
      return;
    }

    setTrades((tradeRes.data ?? []) as Trade[]);
    setFirms((firmRes.data ?? []) as Firm[]);
    setAccounts((accountRes.data ?? []) as Account[]);

    if (!firmId && (firmRes.data ?? []).length > 0) {
      setFirmId((firmRes.data ?? [])[0].id);
    }
    if (!newAccountFirmId && (firmRes.data ?? []).length > 0) {
      setNewAccountFirmId((firmRes.data ?? [])[0].id);
    }
    if (!accountId && (accountRes.data ?? []).length > 0) {
      setAccountId((accountRes.data ?? [])[0].id);
    }

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

  const setupOptions = useMemo(() => {
    const values = new Set<string>();
    COMMON_SETUPS.forEach((s) => values.add(s));
    customSetups.forEach((s) => values.add(s));
    trades.forEach((t) => {
      if (t.setup) values.add(t.setup);
    });
    return Array.from(values);
  }, [trades, customSetups]);

  const accountSizeOptions = useMemo(() => {
    const values = new Set<string>();
    customAccountSizes.forEach((s) => values.add(s));
    accounts.forEach((a) => {
      if (a.account_size) values.add(a.account_size);
    });
    return Array.from(values);
  }, [accounts, customAccountSizes]);

  const firmById = useMemo(() => {
    const map = new Map<string, Firm>();
    firms.forEach((f) => map.set(f.id, f));
    return map;
  }, [firms]);

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const accountsForFirm = useMemo(() => {
    if (!firmId) return accounts;
    return accounts.filter((a) => a.firm_id === firmId);
  }, [accounts, firmId]);

  const filterAccounts = useMemo(() => {
    if (firmFilter === "all") return accounts;
    return accounts.filter((a) => a.firm_id === firmFilter);
  }, [accounts, firmFilter]);

  const filteredBase = useMemo(() => {
    return trades.filter((t) => {
      if (!t.trade_date) return false;
      if (firmFilter !== "all" && t.firm_id !== firmFilter) return false;
      if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
      if (firmTypeFilter !== "all") {
        const firm = t.firm_id ? firmById.get(t.firm_id) : null;
        if (!firm || firm.firm_type !== firmTypeFilter) return false;
      }
      if (symbolFilter.trim()) {
        const sym = (t.symbol ?? "").toLowerCase();
        if (!sym.includes(symbolFilter.trim().toLowerCase())) return false;
      }
      if (setupFilter !== "__ALL__" && (t.setup ?? "") !== setupFilter) return false;
      if (winLossFilter !== "all") {
        const pnlValue = typeof t.pnl === "number" ? t.pnl : 0;
        if (winLossFilter === "win" && pnlValue <= 0) return false;
        if (winLossFilter === "loss" && pnlValue >= 0) return false;
      }
      return true;
    });
  }, [trades, firmFilter, accountFilter, firmTypeFilter, symbolFilter, setupFilter, winLossFilter, firmById]);

  const filteredTrades = useMemo(() => {
    if (!selectedDay) return filteredBase;
    return filteredBase.filter((t) => t.trade_date === selectedDay);
  }, [filteredBase, selectedDay]);


  useEffect(() => {
    if (!firmId) return;
    if (accountsForFirm.length === 0) {
      setAccountId("");
      return;
    }
    if (!accountsForFirm.some((a) => a.id === accountId)) {
      setAccountId(accountsForFirm[0].id);
    }
  }, [firmId, accountsForFirm, accountId]);

  useEffect(() => {
    if (accountFilter === "all") return;
    if (!filterAccounts.some((a) => a.id === accountFilter)) {
      setAccountFilter("all");
    }
  }, [filterAccounts, accountFilter]);

  const dayStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number; symbols: string[] }>();
    for (const t of filteredBase) {
      const key = t.trade_date ?? "";
      if (!key) continue;
      const current = map.get(key) ?? { total: 0, count: 0, symbols: [] as string[] };
      const pnlValue = typeof t.pnl === "number" ? t.pnl : 0;
      current.total += pnlValue;
      current.count += 1;
      if (t.symbol && !current.symbols.includes(t.symbol)) current.symbols.push(t.symbol);
      map.set(key, current);
    }
    return map;
  }, [filteredBase]);

  const groupedDays = useMemo(() => {
    const map = new Map<string, { date: string; trades: Trade[]; total: number }>();
    for (const t of filteredBase) {
      const key = t.trade_date ?? "";
      if (!key) continue;
      const current = map.get(key) ?? { date: key, trades: [] as Trade[], total: 0 };
      current.trades.push(t);
      current.total += typeof t.pnl === "number" ? t.pnl : 0;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filteredBase]);

  const resolveScreenshotUrl = (t: Trade) => {
    if (t.screenshot_url) return t.screenshot_url;
    if (t.screenshot_path) {
      return supabase.storage.from("journal_screenshots").getPublicUrl(t.screenshot_path).data.publicUrl;
    }
    return null;
  };

  const resetForm = () => {
    setEditingId(null);
    setTradeDate(todayStr());
    setSymbol("");
    setDirection("Long");
    setContracts("");
    setSetupValue("");
    setEmotionOption("Neutral");
    setEmotionCustom("");
    setEntryPrice("");
    setExitPrice("");
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

  const addCustomSetup = () => {
    const value = newSetupValue.trim();
    if (!value) return;
    if (!customSetups.includes(value)) {
      setCustomSetups((prev) => [...prev, value]);
    }
    setSetupValue(value);
    setNewSetupValue("");
  };

  const addCustomAccountSize = () => {
    const value = newAccountSize.trim();
    if (!value) return;
    if (!customAccountSizes.includes(value)) {
      setCustomAccountSizes((prev) => [...prev, value]);
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
    return { path, url: data.publicUrl };
  };

  const saveTrade = async (keepAnother = false) => {
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
        firm_id: firmId || null,
        account_id: accountId || null,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : null,
        direction: direction,
        contracts: contracts.trim() ? Number(contracts) : null,
        setup: resolvedSetup,
        emotion: resolvedEmotion,
        entry_price: entryPrice.trim() ? Number(entryPrice) : null,
        exit_price: exitPrice.trim() ? Number(exitPrice) : null,
        entry_time: toISOFromDateAndTime(tradeDate, entryTime),
        exit_time: toISOFromDateAndTime(tradeDate, exitTime),
        pnl: pnl.trim() ? Number(pnl) : null,
        notes: notes.trim() ? notes.trim() : null
      };

      if (payload.entry_price !== null && Number.isNaN(payload.entry_price)) payload.entry_price = null;
      if (payload.exit_price !== null && Number.isNaN(payload.exit_price)) payload.exit_price = null;
      if (payload.contracts !== null && Number.isNaN(payload.contracts)) payload.contracts = null;
      if (payload.pnl !== null && Number.isNaN(payload.pnl)) payload.pnl = null;

      if (screenshotFile) {
        try {
          const uploaded = await uploadScreenshot(screenshotFile, tradeDate);
          payload.screenshot_path = uploaded.path;
          payload.screenshot_url = uploaded.url;
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

      if (keepAnother) {
        setSymbol("");
        setSetupValue("");
        setEntryPrice("");
        setExitPrice("");
        setEntryTime("");
        setExitTime("");
        setPnl("");
        setNotes("");
        setScreenshotFile(null);
        setScreenshotPreview(null);
      } else {
        resetForm();
      }
      fetchTrades(month);
    } finally {
      setIsSaving(false);
    }
  };

  const saveFirm = async () => {
    if (!newFirmName.trim()) {
      setErrorBanner("Firm name is required.");
      return;
    }
    const payload = {
      name: newFirmName.trim(),
      platform: newFirmPlatform.trim() ? newFirmPlatform.trim() : null,
      firm_type: newFirmType
    };
    const { error } = await supabase.from("prop_firms").insert(payload);
    if (error) {
      setErrorBanner(error.message);
      return;
    }
    setFirmModalOpen(false);
    setNewFirmName("");
    setNewFirmPlatform("");
    setNewFirmType("prop");
    fetchTrades(month);
  };

  const saveAccount = async () => {
    if (!newAccountFirmId) {
      setErrorBanner("Select a firm for the account.");
      return;
    }
    if (!newAccountName.trim()) {
      setErrorBanner("Account name is required.");
      return;
    }
    const payload = {
      firm_id: newAccountFirmId,
      name: newAccountName.trim(),
      account_size: newAccountSize.trim() ? newAccountSize.trim() : null,
      account_type: newAccountType
    };
    const { error } = await supabase.from("prop_accounts").insert(payload);
    if (error) {
      setErrorBanner(error.message);
      return;
    }
    setAccountModalOpen(false);
    setNewAccountName("");
    setNewAccountSize("");
    setNewAccountType("eval");
    fetchTrades(month);
  };

  const loadEdit = (t: Trade) => {
    setEditingId(t.id);
    setTradeDate(t.trade_date || todayStr());
    setFirmId(t.firm_id ?? "");
    setAccountId(t.account_id ?? "");
    setSymbol((t.symbol ?? "") as string);
    setDirection(t.direction === "Short" ? "Short" : "Long");
    setContracts(t.contracts !== null && t.contracts !== undefined ? String(t.contracts) : "");
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
    setExitPrice(t.exit_price !== null && t.exit_price !== undefined ? String(t.exit_price) : "");
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
      "firm",
      "account",
      "firm_type",
      "trade_date",
      "symbol",
      "direction",
      "contracts",
      "setup",
      "emotion",
      "entry_price",
      "exit_price",
      "entry_time",
      "exit_time",
      "pnl",
      "notes",
      "screenshot_url"
    ];
    const lines = [headers.join(",")];
    for (const t of rows) {
      const firm = t.firm_id ? firmById.get(t.firm_id) : null;
      const account = t.account_id ? accountById.get(t.account_id) : null;
      const values = [
        firm?.name ?? "",
        account?.name ?? "",
        firm?.firm_type ?? "",
        t.trade_date,
        t.symbol ?? "",
        t.direction ?? "",
        t.contracts ?? "",
        t.setup ?? "",
        t.emotion ?? "",
        t.entry_price ?? "",
        t.exit_price ?? "",
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
    <div className="container" style={{ paddingBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1>Trading Journal</h1>
          <div className="sub">Log trades, patterns, and emotions to refine your edge.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setFirmModalOpen(true)} style={actionBtn}>Add Firm</button>
          <button onClick={() => setAccountModalOpen(true)} style={actionBtn}>Add Account</button>
          <button onClick={exportCsv} style={actionBtn}>Export CSV</button>
        </div>
      </div>

            {errorBanner && (
        <div style={errorBannerStyle}>{errorBanner}</div>
      )}

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Trade Plan</div>
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

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{editingId ? "Edit Trade" : "Add Trade"}</div>
          {editingId && (
            <div style={{ fontSize: 12, color: "var(--accent)" }}>Editing {editingId.slice(0, 8)}...</div>
          )}
        </div>

        <div className="journal-grid">
          <div>
            <label style={label}>Trade date</label>
            <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} style={input} />
          </div>

          <div>
            <label style={label}>Firm</label>
            <select value={firmId} onChange={(e) => setFirmId(e.target.value)} style={input}>
              <option value="">Select firm</option>
              {firms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={label}>Account</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={input}>
                <option value="">Select account</option>
                {accountsForFirm.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.account_size ? ` · ${a.account_size}` : ""}
                  </option>
                ))}
              </select>
              <button onClick={() => setAccountModalOpen(true)} style={btnSecondary}>Add</button>
            </div>
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
            <label style={label}>Add new setup</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newSetupValue}
                onChange={(e) => setNewSetupValue(e.target.value)}
                style={input}
                placeholder="New setup name"
              />
              <button onClick={addCustomSetup} style={btnSecondary}>Add</button>
            </div>
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
            <label style={label}>Exit price</label>
            <input
              type="number"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
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
            <label style={label}>Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as "Long" | "Short")} style={input}>
              <option value="Long">Long</option>
              <option value="Short">Short</option>
            </select>
          </div>

          <div>
            <label style={label}>Contracts</label>
            <input
              type="number"
              value={contracts}
              onChange={(e) => setContracts(e.target.value)}
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
                color: pnl.trim() ? (Number(pnl) >= 0 ? "#4cc88c" : "#ff6b6b") : "var(--text)"
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
          <button onClick={() => saveTrade(false)} style={btnPrimary} disabled={isSaving}>
            {isSaving ? "Saving..." : editingId ? "Update Trade" : "Save Trade"}
          </button>
          {!editingId && (
            <button onClick={() => saveTrade(true)} style={btnSecondary} disabled={isSaving}>
              Save and add another
            </button>
          )}
          <button onClick={resetForm} style={btnSecondary}>Clear</button>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Month Snapshot</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{month}</div>
        </div>

        <div className="journal-filters">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={inputSmall}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Firm type</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "prop", "personal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFirmTypeFilter(t)}
                  style={{
                    ...btnSecondary,
                    padding: "6px 10px",
                    opacity: firmTypeFilter === t ? 1 : 0.7
                  }}
                >
                  {t === "all" ? "All" : t === "prop" ? "Prop" : "Personal"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Firm</span>
            <select value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)} style={inputSmall}>
              <option value="all">All</option>
              {firms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Account</span>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} style={inputSmall}>
              <option value="all">All</option>
              {filterAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Symbol</span>
            <input
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              style={inputSmall}
              placeholder="All"
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Setup</span>
            <select value={setupFilter} onChange={(e) => setSetupFilter(e.target.value)} style={inputSmall}>
              <option value="__ALL__">All</option>
              {setupOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Win/Loss</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "win", "loss"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setWinLossFilter(t)}
                  style={{
                    ...btnSecondary,
                    padding: "6px 10px",
                    opacity: winLossFilter === t ? 1 : 0.7
                  }}
                >
                  {t === "all" ? "All" : t === "win" ? "Wins" : "Losses"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
            {loading ? "Loading..." : `${filteredTrades.length} trade${filteredTrades.length !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      {/* Performance Dashboard */}
      {!loading && <JournalDashboard trades={filteredBase as any} month={month} />}

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {selectedDay ? `Trades on ${toDateLabel(selectedDay)}` : "Trades by Day"}
          </div>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} style={actionBtn}>Clear day filter</button>
          )}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {groupedDays.map((day) => {
            const isExpanded = expandedDays.has(day.date);
            return (
              <div key={day.date} style={tradeCard}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{toDateLabel(day.date)}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{day.trades.length} trade{day.trades.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        ...badge,
                        background: day.total >= 0 ? "rgba(76, 200, 140, 0.15)" : "rgba(255, 107, 107, 0.15)",
                        color: day.total >= 0 ? "#4cc88c" : "#ff6b6b"
                      }}
                    >
                      {pnlBadge(day.total)}
                    </div>
                    <button
                      onClick={() => {
                        setExpandedDays((prev) => {
                          const next = new Set(prev);
                          if (next.has(day.date)) next.delete(day.date);
                          else next.add(day.date);
                          return next;
                        });
                      }}
                      style={btnSecondary}
                    >
                      {isExpanded ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {day.trades.map((t) => {
                      const screenshotUrl = resolveScreenshotUrl(t);
                      return (
                        <div key={t.id} style={{ ...tradeCard, background: "var(--card)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 200 }}>
                              <div style={{ fontWeight: 700 }}>
                                {(t.symbol ?? "—").toUpperCase()} {t.direction ? `• ${t.direction}` : ""}
                              </div>
                              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                                {t.setup ?? "—"} &bull; {t.emotion ?? "—"}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                                Entry: {toTimeLabel(t.entry_time)} &bull; Exit: {toTimeLabel(t.exit_time)}
                              </div>
                              <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                                {t.entry_price != null ? `Entry ${t.entry_price}` : "Entry —"} &bull; {t.exit_price != null ? `Exit ${t.exit_price}` : "Exit —"}
                              </div>
                              {t.notes && (
                                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
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
                                        ? "rgba(76, 200, 140, 0.15)"
                                        : "rgba(255, 107, 107, 0.15)",
                                  color: t.pnl === null || Number.isNaN(t.pnl) ? "var(--muted)" : t.pnl >= 0 ? "#4cc88c" : "#ff6b6b"
                                }}
                              >
                                {pnlBadge(t.pnl)}
                              </div>

                              {screenshotUrl && (
                                <a href={screenshotUrl} target="_blank" rel="noreferrer">
                                  <img
                                    src={screenshotUrl}
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
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {groupedDays.length === 0 && (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>
              {selectedDay ? "No trades logged for this day yet." : "No trades logged for this month yet."}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Calendar</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{month}</div>
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
            return (
              <button
                key={d.key}
                onClick={() => {
                  setSelectedDay(d.key);
                  setExpandedDays((prev) => new Set(prev).add(d.key!));
                }}
                style={{
                  ...calendarCell,
                  borderColor: isSelected ? "var(--accent)" : "var(--border)",
                  background: isSelected ? "rgba(79, 163, 255, 0.12)" : "var(--cardSoft)"
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12 }}>
                  {d.day}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: pnlTotal >= 0 ? "#4cc88c" : "#ff6b6b",
                    marginTop: 6
                  }}
                >
                  {stats ? pnlBadge(pnlTotal) : "—"}
                </div>
                {stats && (
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                    {stats.count} trade{stats.count !== 1 ? "s" : ""}
                  </div>
                )}
                {stats?.symbols?.length ? (
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    {stats.symbols.slice(0, 3).join(", ")}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
{firmModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Add Firm</div>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                style={input}
                placeholder="Firm name"
                value={newFirmName}
                onChange={(e) => setNewFirmName(e.target.value)}
              />
              <input
                style={input}
                placeholder="Platform (optional)"
                value={newFirmPlatform}
                onChange={(e) => setNewFirmPlatform(e.target.value)}
              />
              <select
                style={input}
                value={newFirmType}
                onChange={(e) => setNewFirmType(e.target.value as "prop" | "personal")}
              >
                <option value="prop">Prop</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setFirmModalOpen(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveFirm} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {accountModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Add Account</div>
            <div style={{ display: "grid", gap: 10 }}>
              <select
                style={input}
                value={newAccountFirmId}
                onChange={(e) => setNewAccountFirmId(e.target.value)}
              >
                <option value="">Select firm</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <input
                style={input}
                placeholder="Account name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={input}
                  list="account-size-options"
                  placeholder="Account size (optional)"
                  value={newAccountSize}
                  onChange={(e) => setNewAccountSize(e.target.value)}
                />
                <button onClick={addCustomAccountSize} style={btnSecondary}>Add</button>
              </div>
              <datalist id="account-size-options">
                {accountSizeOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <select
                style={input}
                value={newAccountType}
                onChange={(e) => setNewAccountType(e.target.value)}
              >
                <option value="eval">Eval</option>
                <option value="funded">Funded</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setAccountModalOpen(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveAccount} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

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
        @media (max-width: 900px) {
          :global(.card) > div[style*="grid-template-columns: 1fr 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
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

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--muted)",
  marginBottom: 6,
  fontWeight: 600
};

const input: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--cardSoft)",
  color: "var(--text)",
  width: "100%",
  fontSize: 14
};

const inputSmall: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--cardSoft)",
  color: "var(--text)",
  fontSize: 13
};

const actionBtn: React.CSSProperties = {
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--cardSoft)",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 13
};

const btnDanger: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,59,48,0.3)",
  background: "rgba(255,59,48,0.15)",
  color: "#fca5a5",
  cursor: "pointer",
  fontSize: 13
};

const badge: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 12,
  minWidth: 60,
  textAlign: "center"
};

const tradeCard: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: 14,
  background: "var(--cardSoft)"
};

const errorBannerStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: 12,
  borderRadius: "var(--radius)",
  border: "1px solid rgba(255, 86, 86, 0.4)",
  background: "rgba(255, 86, 86, 0.08)",
  color: "#fca5a5",
  fontSize: 13
};

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
  maxWidth: "90vw",
  borderRadius: 14,
  padding: 20,
  border: "1px solid var(--border)",
  background: "var(--card)"
};

const calendarCell: React.CSSProperties = {
  padding: 8,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--cardSoft)",
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
  background: "transparent"
};




