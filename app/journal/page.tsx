"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, Italic, Code, List, ListOrdered, CheckSquare, Calendar } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { trackActivity } from "../../lib/trackActivity";

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
  commissions: number | null;
  fees: number | null;
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
  setup_screenshot_url: string | null;
  setup_screenshot_path: string | null;
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

type ExtractedTradeFields = {
  symbol: string | null;
  direction: "Long" | "Short" | null;
  entry_time: string | null;
  exit_time: string | null;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  contracts: number | null;
  commissions: number | null;
  fees: number | null;
};

type UploadedScreenshot = {
  path: string;
  url: string;
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

function formatExtractedValue(key: keyof ExtractedTradeFields, value: ExtractedTradeFields[keyof ExtractedTradeFields]) {
  if (value === null || value === undefined || value === "") return "Not found";
  if (key === "entry_time" || key === "exit_time") return String(value);
  return String(value);
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
  const [commissions, setCommissions] = useState("");
  const [fees, setFees] = useState("");
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
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [uploadedScreenshot, setUploadedScreenshot] = useState<UploadedScreenshot | null>(null);
  const [setupScreenshotFile, setSetupScreenshotFile] = useState<File | null>(null);
  const [setupScreenshotPreview, setSetupScreenshotPreview] = useState<string | null>(null);
  const [uploadedSetupScreenshot, setUploadedSetupScreenshot] = useState<UploadedScreenshot | null>(null);
  const [applySetupScreenshotToAll, setApplySetupScreenshotToAll] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSetupDragActive, setIsSetupDragActive] = useState(false);
  const [screenshotRemoved, setScreenshotRemoved] = useState(false);
  const [isExtractingScreenshot, setIsExtractingScreenshot] = useState(false);
  const [extractedTrades, setExtractedTrades] = useState<ExtractedTradeFields[]>([]);
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState(false);
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
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const setupScreenshotInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);

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
      if (setupScreenshotPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(setupScreenshotPreview);
      }
    };
  }, [screenshotPreview, setupScreenshotPreview]);

  useEffect(() => {
    // Load trade plan from Supabase first, fallback to localStorage
    (async () => {
      const { data } = await supabase
        .from("journal_settings")
        .select("value")
        .eq("key", "trade_plan")
        .single();
      if (data?.value) {
        setTestPlanHtml(data.value);
      } else {
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("journal_test_plan_html") : null;
        setTestPlanHtml(saved ?? "");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        trackActivity(userData.user.id, "journal", "opened");
      }
    })();
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
    const map = new Map<string, { gross: number; commissions: number; fees: number; net: number; count: number; symbols: string[] }>();
    for (const t of filteredBase) {
      const key = t.trade_date ?? "";
      if (!key) continue;
      const current = map.get(key) ?? { gross: 0, commissions: 0, fees: 0, net: 0, count: 0, symbols: [] as string[] };
      const pnlValue = typeof t.pnl === "number" ? t.pnl : 0;
      const commissionsValue = typeof t.commissions === "number" ? t.commissions : 0;
      const feesValue = typeof t.fees === "number" ? t.fees : 0;
      current.gross += pnlValue;
      current.commissions += commissionsValue;
      current.fees += feesValue;
      current.net += pnlValue - commissionsValue - feesValue;
      current.count += 1;
      if (t.symbol && !current.symbols.includes(t.symbol)) current.symbols.push(t.symbol);
      map.set(key, current);
    }
    return map;
  }, [filteredBase]);

  const groupedDays = useMemo(() => {
    const map = new Map<string, { date: string; trades: Trade[]; gross: number; commissions: number; fees: number; net: number }>();
    for (const t of filteredBase) {
      const key = t.trade_date ?? "";
      if (!key) continue;
      const current = map.get(key) ?? { date: key, trades: [] as Trade[], gross: 0, commissions: 0, fees: 0, net: 0 };
      const pnlValue = typeof t.pnl === "number" ? t.pnl : 0;
      const commissionsValue = typeof t.commissions === "number" ? t.commissions : 0;
      const feesValue = typeof t.fees === "number" ? t.fees : 0;
      current.trades.push(t);
      current.gross += pnlValue;
      current.commissions += commissionsValue;
      current.fees += feesValue;
      current.net += pnlValue - commissionsValue - feesValue;
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

  const clearManualFields = () => {
    setSetupValue("");
    setEmotionOption("Neutral");
    setEmotionCustom("");
    setNotes("");
  };

  const clearExtractedTradeFields = () => {
    setSymbol("");
    setDirection("Long");
    setContracts("");
    setCommissions("");
    setFees("");
    setEntryPrice("");
    setExitPrice("");
    setEntryTime("");
    setExitTime("");
    setPnl("");
  };

  const clearExtractionQueue = () => {
    setExtractedTrades([]);
    setCurrentTradeIndex(0);
  };

  const clearSetupScreenshotState = () => {
    if (setupScreenshotPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(setupScreenshotPreview);
    }
    setSetupScreenshotFile(null);
    setSetupScreenshotPreview(null);
    setUploadedSetupScreenshot(null);
    if (setupScreenshotInputRef.current) {
      setupScreenshotInputRef.current.value = "";
    }
  };

  const loadExtractedTradeIntoForm = (trade: ExtractedTradeFields) => {
    clearExtractedTradeFields();
    if (trade.symbol) setSymbol(trade.symbol);
    if (trade.direction) setDirection(trade.direction);
    if (trade.entry_time) setEntryTime(trade.entry_time);
    if (trade.exit_time) setExitTime(trade.exit_time);
    if (trade.entry_price !== null) setEntryPrice(String(trade.entry_price));
    if (trade.exit_price !== null) setExitPrice(String(trade.exit_price));
    if (trade.pnl !== null) setPnl(String(trade.pnl));
    if (trade.contracts !== null) setContracts(String(trade.contracts));
    if (trade.commissions !== null) setCommissions(String(trade.commissions));
    if (trade.fees !== null) setFees(String(trade.fees));
  };

  const loadExtractedTrade = (index: number) => {
    const trade = extractedTrades[index];
    if (!trade) return;
    setCurrentTradeIndex(index);
    loadExtractedTradeIntoForm(trade);
    clearManualFields();
    setExtractionError(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setTradeDate(todayStr());
    clearExtractedTradeFields();
    clearManualFields();
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setCurrentScreenshot(null);
    setUploadedScreenshot(null);
    clearSetupScreenshotState();
    setApplySetupScreenshotToAll(false);
    setIsDragActive(false);
    setScreenshotRemoved(false);
    clearExtractionQueue();
    setExtractionMessage(null);
    setExtractionError(false);
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
  };

  const onScreenshotChange = (file: File | null) => {
    if (screenshotPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshotFile(file);
    setUploadedScreenshot(null);
    setScreenshotRemoved(false);
    setExtractionError(false);
    clearExtractionQueue();
    if (file) {
      const url = URL.createObjectURL(file);
      setScreenshotPreview(url);
      setCurrentScreenshot(url);
      setExtractionMessage("Screenshot ready. Extract trade data when you want to prefill the form.");
    } else {
      setScreenshotPreview(null);
      setCurrentScreenshot(null);
      setExtractionMessage(null);
    }
  };

  const onSetupScreenshotChange = (file: File | null) => {
    if (setupScreenshotPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(setupScreenshotPreview);
    }
    setSetupScreenshotFile(file);
    setUploadedSetupScreenshot(null);
    if (file) {
      const url = URL.createObjectURL(file);
      setSetupScreenshotPreview(url);
    } else {
      setSetupScreenshotPreview(null);
    }
  };

  const clearScreenshot = () => {
    if (screenshotPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setCurrentScreenshot(null);
    setUploadedScreenshot(null);
    clearSetupScreenshotState();
    setApplySetupScreenshotToAll(false);
    setScreenshotRemoved(true);
    clearExtractionQueue();
    clearExtractedTradeFields();
    clearManualFields();
    setExtractionMessage(null);
    setExtractionError(false);
    setIsDragActive(false);
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
  };

  const extractScreenshotValues = async (file: File) => {
    setIsExtractingScreenshot(true);
    setExtractionMessage(null);
    setExtractionError(false);
    clearExtractionQueue();
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/journal/extract-screenshot", {
        method: "POST",
        body: formData
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExtractionMessage(payload?.error ?? "Could not extract values from the screenshot.");
        setExtractionError(true);
        return;
      }
      const trades = (Array.isArray(payload?.trades) ? payload.trades : []) as ExtractedTradeFields[];
      if (trades.length === 0) {
        clearExtractedTradeFields();
        setExtractionMessage("No trade rows were extracted from the screenshot.");
        return;
      }
      setExtractedTrades(trades);
      setCurrentTradeIndex(0);
      loadExtractedTradeIntoForm(trades[0]);
      clearManualFields();
      setExtractionMessage(
        trades.length === 1
          ? "Extracted 1 trade. Review and edit before saving."
          : `Extracted ${trades.length} trades. Review each trade before saving.`
      );
    } catch (error: any) {
      setExtractionMessage(error?.message ?? "Could not extract values from the screenshot.");
      setExtractionError(true);
    } finally {
      setIsExtractingScreenshot(false);
    }
  };

  const handleScreenshotUpload = async (file: File | null) => {
    if (!file) return;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg"]);
    if (!allowedTypes.has(file.type)) {
      setExtractionMessage("Only png, jpg, and jpeg files are supported.");
      setExtractionError(true);
      return;
    }
    onScreenshotChange(file);
  };

  const handleSetupScreenshotUpload = async (file: File | null) => {
    if (!file) return;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg"]);
    if (!allowedTypes.has(file.type)) {
      setExtractionMessage("Only png, jpg, and jpeg files are supported.");
      setExtractionError(true);
      return;
    }
    onSetupScreenshotChange(file);
  };

  const handleSetupDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsSetupDragActive(true);
  };

  const handleSetupDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setIsSetupDragActive(true);
  };

  const handleSetupDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsSetupDragActive(false);
  };

  const handleSetupDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsSetupDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    void handleSetupScreenshotUpload(file);
  };

  const triggerScreenshotExtraction = async () => {
    if (!screenshotFile) {
      setExtractionMessage(
        screenshotPreview
          ? "Re-upload this screenshot to extract trade data."
          : "Add a screenshot first, then extract trade data."
      );
      setExtractionError(true);
      return;
    }
    await extractScreenshotValues(screenshotFile);
  };

  const queueActive = !editingId && extractedTrades.length > 1;
  const currentExtractedTrade = extractedTrades[currentTradeIndex] ?? null;
  const queueTotal = extractedTrades.length;
  const queueProgress = queueTotal > 0 ? Math.round(((currentTradeIndex + 1) / queueTotal) * 100) : 0;

  const finishTradeQueue = (message?: string) => {
    clearExtractionQueue();
    clearExtractedTradeFields();
    clearManualFields();
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setCurrentScreenshot(null);
    setUploadedScreenshot(null);
    clearSetupScreenshotState();
    setApplySetupScreenshotToAll(false);
    setIsDragActive(false);
    setIsSetupDragActive(false);
    setScreenshotRemoved(false);
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
    setExtractionMessage(message ?? null);
    setExtractionError(false);
  };

  const moveToQueueTrade = (nextIndex: number, message?: string) => {
    if (nextIndex < 0 || nextIndex >= extractedTrades.length) return;
    console.debug("[journal-queue] moving to extracted trade", {
      from: currentTradeIndex,
      to: nextIndex,
      total: extractedTrades.length
    });
    loadExtractedTrade(nextIndex);
    setExtractionMessage(message ?? `Reviewing trade ${nextIndex + 1} of ${extractedTrades.length}.`);
    setExtractionError(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadPreviousTrade = () => {
    if (!queueActive || currentTradeIndex === 0) return;
    moveToQueueTrade(currentTradeIndex - 1, `Reviewing trade ${currentTradeIndex} of ${extractedTrades.length}.`);
  };

  const skipQueuedTrade = () => {
    if (!queueActive) return;
    const nextIndex = currentTradeIndex + 1;
    if (nextIndex >= extractedTrades.length) {
      finishTradeQueue("Skipped the final extracted trade.");
      return;
    }
    moveToQueueTrade(nextIndex, `Skipped trade ${currentTradeIndex + 1}. Loaded trade ${nextIndex + 1} of ${extractedTrades.length}.`);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    void handleScreenshotUpload(file);
  };

  // Paste-from-clipboard support (Ctrl+V / Cmd+V) for trade screenshot
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Ignore paste when typing in inputs/textareas
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            const ext = file.type.split("/")[1] || "png";
            const renamed = new File([file], `pasted-screenshot-${Date.now()}.${ext}`, { type: file.type });
            void handleScreenshotUpload(renamed);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

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

  const saveTrade = async ({
    keepAnother = false,
    advanceQueue = false
  }: {
    keepAnother?: boolean;
    advanceQueue?: boolean;
  } = {}) => {
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
        commissions: commissions.trim() ? Number(commissions) : null,
        fees: fees.trim() ? Number(fees) : null,
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
      if (payload.commissions !== null && Number.isNaN(payload.commissions)) payload.commissions = null;
      if (payload.fees !== null && Number.isNaN(payload.fees)) payload.fees = null;
      if (payload.pnl !== null && Number.isNaN(payload.pnl)) payload.pnl = null;

      let persistedScreenshot = uploadedScreenshot;
      if (screenshotFile && !persistedScreenshot) {
        try {
          const uploaded = await uploadScreenshot(screenshotFile, tradeDate);
          persistedScreenshot = uploaded;
          setUploadedScreenshot(uploaded);
        } catch (err: any) {
          setErrorBanner(
            err?.message?.includes("bucket")
              ? "Screenshot bucket is missing. Create journal_screenshots in Supabase Storage."
              : `Screenshot upload failed: ${err?.message ?? "Unknown error"}`
          );
          setIsSaving(false);
          return;
        }
      }

      if (persistedScreenshot) {
        payload.screenshot_path = persistedScreenshot.path;
        payload.screenshot_url = persistedScreenshot.url;
      } else if (screenshotRemoved) {
        payload.screenshot_path = null;
        payload.screenshot_url = null;
      } else if (editingId && screenshotPreview && !screenshotPreview.startsWith("blob:")) {
        payload.screenshot_url = screenshotPreview;
      }

      let persistedSetupScreenshot = uploadedSetupScreenshot;
      if (setupScreenshotFile && !persistedSetupScreenshot) {
        try {
          const uploaded = await uploadScreenshot(setupScreenshotFile, tradeDate);
          persistedSetupScreenshot = uploaded;
          setUploadedSetupScreenshot(uploaded);
        } catch (err: any) {
          setErrorBanner(`Setup screenshot upload failed: ${err?.message ?? "Unknown error"}`);
          setIsSaving(false);
          return;
        }
      }

      if (persistedSetupScreenshot) {
        payload.setup_screenshot_path = persistedSetupScreenshot.path;
        payload.setup_screenshot_url = persistedSetupScreenshot.url;
      } else if (editingId && setupScreenshotPreview && !setupScreenshotPreview.startsWith("blob:")) {
        payload.setup_screenshot_url = setupScreenshotPreview;
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

      if (advanceQueue && queueActive) {
        const nextIndex = currentTradeIndex + 1;
        console.debug("[journal-queue] save succeeded", {
          currentTradeIndex,
          nextIndex,
          queueLength: extractedTrades.length
        });
        if (nextIndex < extractedTrades.length) {
          moveToQueueTrade(
            nextIndex,
            `Saved trade ${currentTradeIndex + 1}. Loaded trade ${nextIndex + 1} of ${extractedTrades.length}.`
          );
          if (!applySetupScreenshotToAll) {
            clearSetupScreenshotState();
          }
        } else {
          finishTradeQueue(`Saved trade ${currentTradeIndex + 1} of ${extractedTrades.length}. Queue complete.`);
        }
      } else if (keepAnother) {
        clearExtractedTradeFields();
        clearManualFields();
        setScreenshotFile(null);
        setScreenshotPreview(null);
        setCurrentScreenshot(null);
        setUploadedScreenshot(null);
        clearSetupScreenshotState();
        setApplySetupScreenshotToAll(false);
        setIsDragActive(false);
        setScreenshotRemoved(false);
        clearExtractionQueue();
        setExtractionMessage(null);
        setExtractionError(false);
        if (screenshotInputRef.current) {
          screenshotInputRef.current.value = "";
        }
      } else {
        resetForm();
      }
      fetchTrades(month);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        trackActivity(userData.user.id, "journal", "completed", {
          symbol: payload.symbol,
          pnl: payload.pnl,
          emotion: payload.emotion,
          setup: payload.setup,
        });
      }
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
    setCommissions(t.commissions !== null && t.commissions !== undefined ? String(t.commissions) : "");
    setFees(t.fees !== null && t.fees !== undefined ? String(t.fees) : "");
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
    setScreenshotPreview(resolveScreenshotUrl(t));
    setCurrentScreenshot(resolveScreenshotUrl(t));
    setUploadedScreenshot(null);
    setSetupScreenshotFile(null);
    setSetupScreenshotPreview(t.setup_screenshot_url ?? null);
    setUploadedSetupScreenshot(null);
    setApplySetupScreenshotToAll(false);
    setScreenshotRemoved(false);
    clearExtractionQueue();
    setExtractionMessage(null);
    setExtractionError(false);
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
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
        "commissions",
        "fees",
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
        t.commissions ?? "",
        t.fees ?? "",
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


  const saveTradePlan = async () => {
    setPlanSaving(true);
    setPlanSaved(false);
    const { error } = await supabase
      .from("journal_settings")
      .upsert({ key: "trade_plan", value: testPlanHtml }, { onConflict: "key" });
    setPlanSaving(false);
    if (!error) {
      setPlanSaved(true);
      setTimeout(() => setPlanSaved(false), 2000);
    } else {
      alert("Failed to save: " + error.message);
    }
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
          <button
            onClick={saveTradePlan}
            disabled={planSaving}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              fontWeight: 600,
              background: planSaved ? "#22c55e" : "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: planSaving ? "not-allowed" : "pointer",
              opacity: planSaving ? 0.6 : 1,
            }}
          >
            {planSaving ? "Saving..." : planSaved ? "Saved!" : "Save Plan"}
          </button>
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

        {queueActive && currentExtractedTrade && (
          <div style={queueBannerStyle}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={queueBannerTopRowStyle}>
                <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Review Queue
                </div>
                <div style={queueBadgeStyle}>Detected {queueTotal} trades</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                Trade {currentTradeIndex + 1} of {queueTotal}
              </div>
              <div style={queueProgressTrackStyle}>
                <div style={{ ...queueProgressFillStyle, width: `${queueProgress}%` }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Save each extracted row only after review. Setup, emotion, and notes stay manual for every trade.
              </div>
            </div>
            {currentScreenshot && (
              <img src={currentScreenshot} alt="Queue screenshot thumbnail" style={queueThumbnailStyle} />
            )}
          </div>
        )}

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

          <div>
            <label style={label}>Commissions</label>
            <input
              type="number"
              value={commissions}
              onChange={(e) => setCommissions(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>Fees</label>
            <input
              type="number"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              style={input}
            />
          </div>

          <div className="journal-setup-screenshot">
            <label style={label}>Setup Screenshot (optional)</label>
            <input
              ref={setupScreenshotInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(e) => {
                void handleSetupScreenshotUpload(e.target.files?.[0] ?? null);
              }}
              style={{ display: "none" }}
            />
            <div
              onDragEnter={handleSetupDragEnter}
              onDragOver={handleSetupDragOver}
              onDragLeave={handleSetupDragLeave}
              onDrop={handleSetupDrop}
              style={{
                ...compactDropZoneStyle,
                borderColor: isSetupDragActive ? "rgba(77, 163, 255, 0.85)" : "rgba(255,255,255,0.12)",
                background: isSetupDragActive
                  ? "linear-gradient(180deg, rgba(77, 163, 255, 0.14), rgba(16, 28, 48, 0.94))"
                  : "rgba(255,255,255,0.03)"
              }}
            >
              <div style={compactDropZoneTopStyle}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {isSetupDragActive ? "Drop setup screenshot" : "Drag and drop or browse"}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
                    Optional reference image for the setup. Saved separately from the trade screenshot.
                  </div>
                </div>
                {setupScreenshotPreview && (
                  <img
                    src={setupScreenshotPreview}
                    alt="Setup screenshot preview"
                    style={compactSetupPreviewStyle}
                  />
                )}
              </div>
              <div style={compactDropZoneActionsStyle}>
                <button
                  type="button"
                  onClick={() => setupScreenshotInputRef.current?.click()}
                  style={btnSecondary}
                >
                  {setupScreenshotPreview ? "Replace" : "Browse"}
                </button>
                {setupScreenshotPreview && (
                  <button
                    type="button"
                    onClick={clearSetupScreenshotState}
                    style={btnSecondary}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {queueActive && (
              <label style={{ ...queueToggleStyle, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={applySetupScreenshotToAll}
                  onChange={(e) => setApplySetupScreenshotToAll(e.target.checked)}
                  style={checkboxStyle}
                />
                <span>Apply setup screenshot to all extracted trades</span>
              </label>
            )}
          </div>

          <div className="journal-notes">
            <label style={label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...input, width: "100%", minHeight: 110, resize: "vertical" }}
            />
          </div>

          <div className="journal-screenshot-stack">
            <label style={label}>Screenshot</label>
            <div className="journal-screenshot-columns">
              <div style={screenshotSectionCardStyle}>
                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={(e) => {
                    void handleScreenshotUpload(e.target.files?.[0] ?? null);
                  }}
                  style={{ display: "none" }}
                />
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    ...dropZoneStyle,
                    borderColor: isDragActive ? "rgba(77, 163, 255, 0.85)" : "rgba(77, 163, 255, 0.3)",
                    background: isDragActive
                      ? "linear-gradient(180deg, rgba(77, 163, 255, 0.16), rgba(16, 28, 48, 0.95))"
                      : "linear-gradient(180deg, rgba(77, 163, 255, 0.08), rgba(16, 28, 48, 0.92))",
                    boxShadow: isDragActive ? "0 0 0 1px rgba(77, 163, 255, 0.28), 0 20px 40px rgba(2, 8, 23, 0.35)" : "none"
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {isDragActive ? "Drop screenshot to attach" : "Drag, drop, or paste a trade screenshot"}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                    PNG and JPEG only. You can also press Ctrl+V (Cmd+V on Mac) to paste from clipboard, or browse for a file.
                  </div>
                  <button
                    type="button"
                    onClick={() => screenshotInputRef.current?.click()}
                    style={btnSecondary}
                    disabled={isExtractingScreenshot}
                  >
                    Browse Screenshot
                  </button>
                </div>

                {screenshotPreview && (
                  <div className="journal-screenshot-preview" style={screenshotPreviewWrap}>
                    <img
                      src={screenshotPreview}
                      alt="Screenshot preview"
                      style={screenshotPreviewImage}
                    />
                    <div style={screenshotPreviewContentStyle}>
                      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                        Screenshot attached. It will stay linked to this journal entry while you review and save each trade.
                      </div>
                      <div style={screenshotPreviewActionsStyle}>
                        <button
                          type="button"
                          onClick={() => void triggerScreenshotExtraction()}
                          style={{ ...btnPrimary, width: "100%" }}
                          disabled={isExtractingScreenshot}
                        >
                          {isExtractingScreenshot ? "Extracting..." : "Extract Trade Data"}
                        </button>
                        <button
                          type="button"
                          onClick={clearScreenshot}
                          style={{ ...btnSecondary, width: "100%" }}
                          disabled={isExtractingScreenshot}
                        >
                          Clear Screenshot
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {extractionMessage && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: extractionError ? "#fca5a5" : "var(--muted)"
                    }}
                  >
                    {extractionMessage}
                  </div>
                )}
              </div>

              {currentExtractedTrade && (
                <div style={previewCard}>
                  <div style={previewTitle}>{queueActive ? "Queued trade preview" : "Extracted values"}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    Review these values, then edit any field in the form before saving.
                  </div>
                  <div className="journal-preview-grid">
                    {(
                      [
                        ["symbol", "Symbol"],
                        ["direction", "Direction"],
                        ["entry_time", "Entry time"],
                        ["exit_time", "Exit time"],
                        ["entry_price", "Entry price"],
                        ["exit_price", "Exit price"],
                        ["pnl", "PnL"],
                        ["contracts", "Contracts"],
                        ["commissions", "Commissions"],
                        ["fees", "Fees"]
                      ] as Array<[keyof ExtractedTradeFields, string]>
                    ).map(([key, labelText]) => (
                      <div key={key} style={previewItem}>
                        <div style={previewLabel}>{labelText}</div>
                        <div style={previewValue}>{formatExtractedValue(key, currentExtractedTrade[key])}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="journal-buttons">
          {!queueActive && (
            <button onClick={() => saveTrade({ keepAnother: false })} style={btnPrimary} disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update Trade" : "Save Trade"}
            </button>
          )}
          {!editingId && !queueActive && (
            <button onClick={() => saveTrade({ keepAnother: true })} style={btnSecondary} disabled={isSaving}>
              Save and add another
            </button>
          )}
          <button onClick={resetForm} style={btnSecondary}>Clear</button>
        </div>
        {queueActive && (
          <div style={queueFooterStyle}>
            <button onClick={loadPreviousTrade} style={btnSecondary} disabled={isSaving || currentTradeIndex === 0}>
              Previous
            </button>
            <button onClick={skipQueuedTrade} style={btnSecondary} disabled={isSaving}>
              Skip Trade
            </button>
            <button onClick={() => saveTrade({ advanceQueue: true })} style={btnPrimary} disabled={isSaving}>
              {isSaving ? "Saving..." : currentTradeIndex + 1 >= queueTotal ? "Save & Finish" : "Save & Next"}
            </button>
          </div>
        )}
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
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700 }}>{toDateLabel(day.date)}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{day.trades.length} trade{day.trades.length !== 1 ? "s" : ""}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                      <span>Gross PnL: {pnlBadge(day.gross)}</span>
                      <span>Commissions: {day.commissions}</span>
                      <span>Fees: {day.fees}</span>
                      <span style={{ color: day.net >= 0 ? "#4cc88c" : "#ff6b6b" }}>Net: {pnlBadge(day.net)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        ...badge,
                        background: day.net >= 0 ? "rgba(76, 200, 140, 0.15)" : "rgba(255, 107, 107, 0.15)",
                        color: day.net >= 0 ? "#4cc88c" : "#ff6b6b"
                      }}
                    >
                      {pnlBadge(day.net)}
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
                    <div style={dayBreakdownStyle}>
                      <div style={dayBreakdownTitleStyle}>Daily Breakdown</div>
                      <div style={dayBreakdownGridStyle}>
                        <div style={dayBreakdownItemStyle}>
                          <span style={dayBreakdownLabelStyle}>Gross PnL</span>
                          <strong>{pnlBadge(day.gross)}</strong>
                        </div>
                        <div style={dayBreakdownItemStyle}>
                          <span style={dayBreakdownLabelStyle}>Commissions</span>
                          <strong>{day.commissions}</strong>
                        </div>
                        <div style={dayBreakdownItemStyle}>
                          <span style={dayBreakdownLabelStyle}>Fees</span>
                          <strong>{day.fees}</strong>
                        </div>
                        <div style={dayBreakdownItemStyle}>
                          <span style={dayBreakdownLabelStyle}>Net</span>
                          <strong style={{ color: day.net >= 0 ? "#4cc88c" : "#ff6b6b" }}>{pnlBadge(day.net)}</strong>
                        </div>
                      </div>
                    </div>
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
            const pnlTotal = stats?.net ?? 0;
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
        .journal-setup-screenshot {
          grid-column: span 2;
        }
        .journal-screenshot-stack {
          grid-column: span 2;
        }
        .journal-buttons {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .journal-screenshot-columns {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
          gap: 12px;
          align-items: stretch;
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
          .journal-setup-screenshot {
            grid-column: span 1;
          }
          .journal-screenshot-stack {
            grid-column: span 1;
          }
          .journal-buttons button {
            width: 100%;
          }
          .journal-screenshot-columns {
            grid-template-columns: 1fr;
          }
          :global(.journal-screenshot-preview) {
            grid-template-columns: 1fr;
          }
          .calendar-grid {
            grid-template-columns: repeat(7, minmax(44px, 1fr));
          }
        }
        .journal-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 12px;
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

const previewCard: React.CSSProperties = {
  border: "1px solid rgba(79, 163, 255, 0.24)",
  borderRadius: "var(--radius)",
  padding: 14,
  background: "rgba(79, 163, 255, 0.08)",
  minHeight: "100%"
};

const queueBannerStyle: React.CSSProperties = {
  marginTop: 14,
  marginBottom: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(77, 163, 255, 0.24)",
  background: "linear-gradient(180deg, rgba(77, 163, 255, 0.12), rgba(22, 36, 58, 0.92))",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap"
};

const queueBannerTopRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap"
};

const queueBadgeStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(77, 163, 255, 0.24)",
  background: "rgba(77, 163, 255, 0.12)",
  color: "#c7e0ff",
  fontSize: 11,
  fontWeight: 700
};

const queueProgressTrackStyle: React.CSSProperties = {
  marginTop: 10,
  height: 6,
  width: "100%",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden"
};

const queueProgressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #4da3ff, #7bc4ff)"
};

const queueThumbnailStyle: React.CSSProperties = {
  width: 112,
  aspectRatio: "16 / 10",
  objectFit: "cover",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  flexShrink: 0
};

const queueFooterStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center"
};

const screenshotSectionCardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
  padding: 14,
  minHeight: "100%",
  display: "grid",
  gap: 12,
  alignContent: "start"
};

const dropZoneStyle: React.CSSProperties = {
  border: "1px dashed rgba(77, 163, 255, 0.3)",
  borderRadius: 14,
  padding: 18,
  minHeight: 168,
  display: "grid",
  alignContent: "center",
  justifyItems: "start",
  gap: 10,
  transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease"
};

const screenshotPreviewWrap: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 12,
  alignItems: "start"
};

const screenshotPreviewImage: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  aspectRatio: "16 / 10",
  objectFit: "cover",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)"
};

const screenshotPreviewContentStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100%",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 12
};

const screenshotPreviewActionsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8
};

const compactDropZoneStyle: React.CSSProperties = {
  border: "1px dashed rgba(255,255,255,0.12)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  padding: 12,
  display: "grid",
  gap: 10
};

const compactDropZoneTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap"
};

const compactDropZoneActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center"
};

const compactSetupPreviewStyle: React.CSSProperties = {
  width: 88,
  aspectRatio: "16 / 10",
  objectFit: "cover",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  flexShrink: 0
};

const dayBreakdownStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  padding: 12
};

const dayBreakdownTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 10
};

const dayBreakdownGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10
};

const dayBreakdownItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 10,
  borderRadius: 10,
  background: "rgba(8, 15, 29, 0.28)",
  border: "1px solid rgba(255,255,255,0.05)"
};

const dayBreakdownLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em"
};

const queueToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  fontSize: 12,
  color: "var(--muted)",
  lineHeight: 1.4,
  flexWrap: "wrap"
};

const checkboxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  minHeight: 16,
  margin: "1px 0 0",
  padding: 0,
  borderRadius: 4,
  flex: "0 0 auto",
  accentColor: "var(--accent)"
};

const previewTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14
};

const previewItem: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 10,
  background: "var(--card)"
};

const previewLabel: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em"
};

const previewValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  fontWeight: 600
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




