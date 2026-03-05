"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Plus, UserPlus, NotebookPen, KanbanSquare } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  program: string | null;
  status: string | null;
  follow_up_at?: string | null;
  archived?: boolean | null;
};

type Student = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  program: string | null;
  total_fee: number | null;
  paid_in_full: boolean | null;
  created_at?: string | null;
};

type Payment = {
  id?: string | null;
  student_id: string | null;
  amount: number | null;
  payment_date?: string | null;
  created_at?: string | null;
};

type Kpis = {
  totalActiveLeads: number | null;
  followUpsToday: number | null;
  overdueFollowUps: number | null;
  activeStudents: number | null;
  revenueThisMonth: number | null;
  paymentsThisMonth: number | null;
  outstandingBalance: number | null;
};

type Badge = {
  label: string;
  tone: "green" | "orange" | "red" | "gray";
};

type KpiCard = {
  id: string;
  label: string;
  value: number | string | null;
  subtitle?: string;
  tone?: "good" | "warn" | "danger" | "dangerSoft" | "alert" | "neutral";
};

const leadColumns = [
  "id",
  "full_name",
  "name",
  "email",
  "program",
  "status",
  "follow_up_at",
  "last_contacted_at",
  "archived"
];

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

async function safeSelectLeads<T>(
  buildQuery: (cols: string) => Promise<{ data: T[] | null; error: { message: string } | null }> | any
) {
  let cols = [...leadColumns];
  let missingArchived = false;
  let missingFollowUp = false;
  let missingLastContacted = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await buildQuery(cols.join(","));

    if (!error) {
      return {
        data: data ?? [],
        missingArchived,
        missingFollowUp,
        missingLastContacted,
        columns: cols,
        error: null
      };
    }

    const msg = error.message.toLowerCase();
    let changed = false;

    if (msg.includes("archived")) {
      missingArchived = true;
      cols = cols.filter((c) => c !== "archived");
      changed = true;
    }

    if (msg.includes("follow_up_at")) {
      missingFollowUp = true;
      cols = cols.filter((c) => c !== "follow_up_at");
      changed = true;
    }

    if (msg.includes("last_contacted_at")) {
      missingLastContacted = true;
      cols = cols.filter((c) => c !== "last_contacted_at");
      changed = true;
    }

    if (!changed) {
      return {
        data: [],
        missingArchived,
        missingFollowUp,
        missingLastContacted,
        columns: cols,
        error: error.message
      };
    }
  }

  return {
    data: [],
    missingArchived,
    missingFollowUp,
    missingLastContacted,
    columns: cols,
    error: "Failed to load leads"
  };
}

function money(value: number) {
  return moneyFormatter.format(value);
}

function leadDisplayName(l: Lead) {
  const full = (l.full_name ?? "").trim();
  if (full) return full;
  const name = (l.name ?? "").trim();
  if (name) return name;
  const email = (l.email ?? "").trim();
  return email || "Unnamed";
}

function studentDisplayName(s: Student) {
  const full = (s.full_name ?? "").trim();
  if (full) return full;
  const name = (s.name ?? "").trim();
  if (name) return name;
  const email = (s.email ?? "").trim();
  return email || "Unnamed";
}

function formatRelativeDue(iso?: string | null, now = new Date()) {
  if (!iso) return "No date";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "No date";

  const startNow = new Date(now);
  startNow.setHours(0, 0, 0, 0);
  const startTarget = new Date(target);
  startTarget.setHours(0, 0, 0, 0);

  const diffDays = Math.round((startTarget.getTime() - startNow.getTime()) / (24 * 60 * 60 * 1000));
  const abs = Math.abs(diffDays);
  const dayLabel = abs === 1 ? "day" : "days";

  if (diffDays === 0) return "Today";
  if (diffDays > 0) return `Due in ${abs} ${dayLabel}`;
  return `Overdue by ${abs} ${dayLabel}`;
}

function getBadge(student: Student, paidByStudent: Record<string, number>): Badge {
  const totalFee = typeof student.total_fee === "number" ? student.total_fee : 0;
  const paid = paidByStudent[student.id] ?? 0;
  const balance = totalFee - paid;

  if (student.paid_in_full) return { label: "PAID IN FULL", tone: "green" };
  if (!totalFee) return { label: "NO FEE SET", tone: "gray" };
  if (balance > 0) return { label: `BALANCE ${money(Math.max(balance, 0))}`, tone: "orange" };
  return { label: "PAID IN FULL", tone: "green" };
}

function getMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  next.setHours(0, 0, 0, 0);
  return { startISO: start.toISOString(), nextISO: next.toISOString() };
}

export default function DashboardPage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [kpis, setKpis] = useState<Kpis>({
    totalActiveLeads: null,
    followUpsToday: null,
    overdueFollowUps: null,
    activeStudents: null,
    revenueThisMonth: null,
    paymentsThisMonth: null,
    outstandingBalance: null
  });
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<Lead[]>([]);
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [paidByStudent, setPaidByStudent] = useState<Record<string, number>>({});
  const [recentPaidByStudent, setRecentPaidByStudent] = useState<Record<string, number>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showFollowUps, setShowFollowUps] = useState(true);
  const [contactedHint, setContactedHint] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [disableMarkContacted, setDisableMarkContacted] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    setContactedHint(null);
    setShowFollowUps(true);

      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setHours(23, 59, 59, 999);
      const { startISO: monthStartISO, nextISO: monthNextISO } = getMonthRange(now);

      const probe = await safeSelectLeads<Lead>((cols) =>
        supabase.from("leads").select(cols).limit(1)
      );

      if (!mountedRef.current) return;

      if (probe.error) {
        setError(probe.error);
      }

      const hasArchived = !probe.missingArchived;
      const hasFollowUp = !probe.missingFollowUp;
      if (probe.missingLastContacted) {
        setDisableMarkContacted(true);
        setContactedHint("Mark contacted needs last_contacted_at column.");
      } else {
        setDisableMarkContacted(false);
      }

      if (!hasFollowUp) {
        setWarning("Follow-up widgets are hidden because the leads table is missing follow_up_at.");
        setShowFollowUps(false);
      }

      const applyActiveFilter = <T,>(query: any) => {
        if (!hasArchived) return query;
        return query.or("archived.is.null,archived.eq.false");
      };

      const totalActiveLeadsQuery = applyActiveFilter(
        supabase.from("leads").select("id", { count: "exact", head: true })
      );

      const activeStudentsQuery = supabase
        .from("students")
        .select("id", { count: "exact", head: true });

      const recentStudentsQuery = supabase
        .from("students")
        .select("id,full_name,name,email,program,total_fee,paid_in_full,created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      const studentsForBalanceQuery = supabase
        .from("students")
        .select("id,total_fee,paid_in_full");

      const paymentsForBalanceQuery = supabase
        .from("payments")
        .select("student_id,amount");

      const revenueThisMonthQuery = supabase
        .from("payments")
        .select("id,amount,payment_date,created_at")
        .or(
          `and(payment_date.gte.${monthStartISO},payment_date.lt.${monthNextISO}),and(payment_date.is.null,created_at.gte.${monthStartISO},created_at.lt.${monthNextISO})`
        );

      const followUpsTodayQuery = hasFollowUp
        ? applyActiveFilter(
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .not("status", "in", "(Lost,lost)")
              .gte("follow_up_at", now.toISOString())
              .lte("follow_up_at", end.toISOString())
          )
        : null;

      const overdueFollowUpsQuery = hasFollowUp
        ? applyActiveFilter(
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .not("status", "in", "(Lost,lost)")
              .lt("follow_up_at", now.toISOString())
          )
        : null;

      const upcomingFollowUpsQuery = hasFollowUp
        ? applyActiveFilter(
            supabase
              .from("leads")
              .select("id,full_name,name,email,program,status,follow_up_at")
              .not("status", "in", "(Lost,lost)")
              .gte("follow_up_at", now.toISOString())
              .lte("follow_up_at", weekEnd.toISOString())
              .order("follow_up_at", { ascending: true })
              .limit(12)
          )
        : null;

      const queries = [
        totalActiveLeadsQuery,
        activeStudentsQuery,
        recentStudentsQuery,
        studentsForBalanceQuery,
        paymentsForBalanceQuery,
        revenueThisMonthQuery,
        followUpsTodayQuery,
        overdueFollowUpsQuery,
        upcomingFollowUpsQuery
      ].filter(Boolean) as Promise<any>[];

      const results = await Promise.all(queries);

      if (!mountedRef.current) return;

      let idx = 0;
      const totalActiveRes = results[idx++];
      const activeStudentsRes = results[idx++];
      const recentStudentsRes = results[idx++];
      const studentsForBalanceRes = results[idx++];
      const paymentsForBalanceRes = results[idx++];
      const revenueThisMonthRes = results[idx++];
      const followUpsTodayRes = hasFollowUp ? results[idx++] : null;
      const overdueFollowUpsRes = hasFollowUp ? results[idx++] : null;
      const upcomingFollowUpsRes = hasFollowUp ? results[idx++] : null;

      const firstError =
        totalActiveRes?.error?.message ||
        activeStudentsRes?.error?.message ||
        recentStudentsRes?.error?.message ||
        studentsForBalanceRes?.error?.message ||
        paymentsForBalanceRes?.error?.message ||
        revenueThisMonthRes?.error?.message ||
        followUpsTodayRes?.error?.message ||
        overdueFollowUpsRes?.error?.message ||
        upcomingFollowUpsRes?.error?.message ||
        null;

      if (firstError) {
        setError(firstError);
      }

      const revenueRows = (revenueThisMonthRes?.data ?? []) as Payment[];
      const revenueThisMonth = revenueRows.reduce((sum, p) => {
        const amt = typeof p.amount === "number" ? p.amount : 0;
        return sum + amt;
      }, 0);
      const paymentsThisMonth = revenueRows.length;

      const studentsRows = (studentsForBalanceRes?.data ?? []) as Student[];
      const paymentsRows = (paymentsForBalanceRes?.data ?? []) as Payment[];

      const paidMap: Record<string, number> = {};
      for (const p of paymentsRows) {
        if (!p.student_id) continue;
        const amt = typeof p.amount === "number" ? p.amount : 0;
        paidMap[p.student_id] = (paidMap[p.student_id] ?? 0) + amt;
      }

      const outstandingBalance = studentsRows.reduce((sum, s) => {
        const totalFee = typeof s.total_fee === "number" ? s.total_fee : 0;
        const paid = paidMap[s.id] ?? 0;
        if (s.paid_in_full) return sum;
        return sum + Math.max(totalFee - paid, 0);
      }, 0);

      const nextPending = studentsRows.reduce((count, s) => {
        const totalFee = typeof s.total_fee === "number" ? s.total_fee : 0;
        const paid = paidMap[s.id] ?? 0;
        const balance = totalFee - paid;
        if (totalFee > 0 && !s.paid_in_full && balance > 0) return count + 1;
        return count;
      }, 0);

      const nextKpis: Kpis = {
        totalActiveLeads: typeof totalActiveRes?.count === "number" ? totalActiveRes.count : 0,
        followUpsToday: hasFollowUp && typeof followUpsTodayRes?.count === "number" ? followUpsTodayRes.count : null,
        overdueFollowUps: hasFollowUp && typeof overdueFollowUpsRes?.count === "number" ? overdueFollowUpsRes.count : null,
        activeStudents: typeof activeStudentsRes?.count === "number" ? activeStudentsRes.count : 0,
        revenueThisMonth,
        paymentsThisMonth,
        outstandingBalance
      };

      const recentRows = (recentStudentsRes?.data ?? []) as Student[];
      const recentIds = recentRows.map((s) => s.id).filter(Boolean);
      const recentPaidMap: Record<string, number> = {};
      if (recentIds.length) {
        const recentPaymentsRes = await supabase
          .from("payments")
          .select("student_id,amount")
          .in("student_id", recentIds);
        if (recentPaymentsRes.error) {
          setError((prev) => prev ?? recentPaymentsRes.error?.message ?? "Failed to load recent payments.");
        } else {
          for (const p of (recentPaymentsRes.data ?? []) as Payment[]) {
            if (!p.student_id) continue;
            const amt = typeof p.amount === "number" ? p.amount : 0;
            recentPaidMap[p.student_id] = (recentPaidMap[p.student_id] ?? 0) + amt;
          }
        }
      }

      setKpis(nextKpis);
      setPaidByStudent(paidMap);
      setRecentPaidByStudent(recentPaidMap);
      setPendingCount(nextPending);
      setUpcomingFollowUps((upcomingFollowUpsRes?.data ?? []) as Lead[]);
      setRecentStudents(recentRows);
      setLoading(false);
    };

  useEffect(() => {
    mountedRef.current = true;
    loadDashboard();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const markContacted = async (lead: Lead) => {
    if (disableMarkContacted || markingId) return;
    setMarkingId(lead.id);
    const payload: Record<string, string> = {
      status: "Contacted",
      last_contacted_at: new Date().toISOString()
    };
    const { error: updateError } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", lead.id);
    if (updateError) {
      const msg = updateError.message || "Unable to mark contacted.";
      if (msg.toLowerCase().includes("last_contacted_at")) {
        setDisableMarkContacted(true);
        setContactedHint("Add the last_contacted_at column (migration) to enable.");
      } else if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("policy")) {
        setDisableMarkContacted(true);
        setContactedHint("Update blocked by RLS policy. Add a policy to allow updates.");
      } else {
        setContactedHint(msg);
      }
    } else {
      await loadDashboard();
    }
    setMarkingId(null);
  };

  const kpiCards: (KpiCard | null)[] = [
    {
      id: "total",
      label: "Total Active Leads",
      value: kpis.totalActiveLeads,
      subtitle: "Not archived"
    },
    showFollowUps
      ? {
          id: "today",
          label: "Follow ups Today",
          value: kpis.followUpsToday,
          subtitle: "Due before end of day",
          tone: !loading && (kpis.followUpsToday ?? 0) > 0 ? "alert" : "neutral"
        }
      : null,
    showFollowUps
      ? {
          id: "overdue",
          label: "Overdue Follow ups",
          value: kpis.overdueFollowUps,
          subtitle: "Past due",
          tone: !loading && (kpis.overdueFollowUps ?? 0) > 0 ? "dangerSoft" : "neutral"
        }
      : null,
    {
      id: "students",
      label: "Active Students",
      value: kpis.activeStudents,
      subtitle: "Current list"
    },
    {
      id: "revenue",
      label: "Revenue This Month",
      value: money(kpis.revenueThisMonth ?? 0),
      subtitle: "Received payments",
      tone: !loading && (kpis.revenueThisMonth ?? 0) > 0 ? "good" : "neutral"
    },
    {
      id: "payments",
      label: "Payments This Month",
      value: kpis.paymentsThisMonth,
      subtitle: "Payment count"
    },
    {
      id: "outstanding",
      label: "Outstanding Balance",
      value: money(kpis.outstandingBalance ?? 0),
      subtitle: `${pendingCount} students pending`,
      tone: !loading && (kpis.outstandingBalance ?? 0) > 0 ? "warn" : "neutral"
    }
  ];

  const filteredKpis = kpiCards.filter(Boolean) as KpiCard[];

  const now = new Date();
  const operationalCards = filteredKpis.filter((k) =>
    ["total", "today", "overdue", "students"].includes(k.id)
  );
  const financialCards = filteredKpis.filter((k) =>
    ["revenue", "payments", "outstanding"].includes(k.id)
  );

  const placeholderCard = {
    id: null as string | null,
    label: "",
    value: null,
    subtitle: undefined,
    tone: undefined
  };

  const kpiRoutes: Record<string, string> = {
    total: "/leads?status=active",
    today: "/leads?followup=today",
    overdue: "/leads?followup=overdue",
    students: "/students",
    revenue: "/students?tab=payments&range=this_month",
    payments: "/students?tab=payments&range=this_month",
    outstanding: "/students?balance=gt0"
  };

  const onCardActivate = (id: string) => {
    const href = kpiRoutes[id];
    if (href) router.push(href);
  };

  return (
    <div className="container" style={{ paddingBottom: 30 }}>
      <div style={{ marginBottom: 12 }}>
        <h1>Dashboard</h1>
        <div className="sub">Key numbers and upcoming items at a glance.</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Link href="/leads" style={quickActionStyle}>
          <Plus size={16} strokeWidth={2} className="opacity-80" />
          Add Lead
        </Link>
        <Link href="/students" style={quickActionStyle}>
          <UserPlus size={16} strokeWidth={2} className="opacity-80" />
          Add Student
        </Link>
        <Link href="/journal" style={quickActionStyle}>
          <NotebookPen size={16} strokeWidth={2} className="opacity-80" />
          Log Trade
        </Link>
        <Link href="/pipeline" style={quickActionStyle}>
          <KanbanSquare size={16} strokeWidth={2} className="opacity-80" />
          View Pipeline
        </Link>
      </div>

      {warning ? (
        <div
          className="card"
          style={{
            borderColor: "rgba(255, 214, 120, 0.35)",
            background: "rgba(255, 214, 120, 0.08)",
            marginBottom: 16
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Limited data</div>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>{warning}</div>
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

      <div style={{ display: "grid", gap: 14 }}>
        <div style={kpiGridStyle}>
          {(loading
            ? Array.from({ length: operationalCards.length || 4 }, () => placeholderCard)
            : operationalCards
          ).map((k, idx) => (
            <div
              key={k.id ?? `op-${idx}`}
              className="card"
              role={k.id ? "button" : undefined}
              tabIndex={k.id ? 0 : undefined}
              onClick={k.id ? () => onCardActivate(k.id as string) : undefined}
              onKeyDown={
                k.id
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onCardActivate(k.id as string);
                    }
                  : undefined
              }
              onMouseEnter={k.id ? () => setHoveredCardId(k.id as string) : undefined}
              onMouseLeave={k.id ? () => setHoveredCardId(null) : undefined}
              style={{
                ...kpiCardStyle,
                ...kpiToneStyle(k.tone),
                ...(k.id && hoveredCardId === k.id ? kpiHoverStyle : null),
                cursor: k.id ? "pointer" : "default"
              }}
            >
              {loading ? (
                <>
                  <div style={skeletonLineShort} />
                  <div style={skeletonLineTall} />
                  <div style={skeletonLineSmall} />
                </>
              ) : (
                <>
                  <div style={kpiTitleStyle}>
                    {k.label}
                    {k.id === "overdue" && Number(k.value ?? 0) > 0 ? <span style={urgentDot} /> : null}
                  </div>
                  <div style={kpiValueStyle}>{k.value ?? "—"}</div>
                  {k.subtitle ? <div style={kpiSubtitleStyle}>{k.subtitle}</div> : null}
                </>
              )}
            </div>
          ))}
        </div>

        <div style={kpiGridStyle}>
          {(loading
            ? Array.from({ length: financialCards.length || 3 }, () => placeholderCard)
            : financialCards
          ).map((k, idx) => (
            <div
              key={k.id ?? `fin-${idx}`}
              className="card"
              role={k.id ? "button" : undefined}
              tabIndex={k.id ? 0 : undefined}
              onClick={k.id ? () => onCardActivate(k.id as string) : undefined}
              onKeyDown={
                k.id
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onCardActivate(k.id as string);
                    }
                  : undefined
              }
              onMouseEnter={k.id ? () => setHoveredCardId(k.id as string) : undefined}
              onMouseLeave={k.id ? () => setHoveredCardId(null) : undefined}
              style={{
                ...kpiCardStyle,
                ...kpiToneStyle(k.tone),
                ...(k.id && hoveredCardId === k.id ? kpiHoverStyle : null),
                cursor: k.id ? "pointer" : "default"
              }}
            >
              {loading ? (
                <>
                  <div style={skeletonLineShort} />
                  <div style={skeletonLineTall} />
                  <div style={skeletonLineSmall} />
                </>
              ) : (
                <>
                  <div style={kpiTitleStyle}>{k.label}</div>
                  <div style={kpiValueStyle}>{k.value ?? "—"}</div>
                  {k.subtitle ? <div style={kpiSubtitleStyle}>{k.subtitle}</div> : null}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginTop: 18
        }}
      >
        {showFollowUps ? (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 600 }}>Upcoming Follow ups (next 7 days)</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {loading ? "" : `${upcomingFollowUps.length} items`}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {loading ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={`fu-skel-${idx}`} style={listRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={skeletonLineShort} />
                        <div style={{ ...skeletonLineSmall, width: 160, marginTop: 6 }} />
                      </div>
                      <div style={{ width: 120 }}>
                        <div style={skeletonLineSmall} />
                        <div style={{ ...skeletonLineSmall, width: 90, marginTop: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingFollowUps.length === 0 ? (
                <div style={emptyStateStyle}>
                  <div style={{ fontWeight: 600 }}>No follow ups scheduled</div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    You are clear for the next 7 days. Add a follow-up to stay on track.
                  </div>
                </div>
              ) : (
                upcomingFollowUps.map((lead) => {
                  const relative = formatRelativeDue(lead.follow_up_at, now);
                  const exact = lead.follow_up_at ? new Date(lead.follow_up_at).toLocaleString() : "—";
                  return (
                    <div key={lead.id} style={listRowStyle}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{leadDisplayName(lead)}</div>
                        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                          {lead.program ?? "—"} • {lead.status ?? "—"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{relative}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{exact}</div>
                        <button
                          style={{
                            ...markButtonStyle,
                            opacity:
                              disableMarkContacted ||
                              (lead.status ?? "").toString().toLowerCase() === "contacted" ||
                              markingId === lead.id
                                ? 0.6
                                : 1
                          }}
                          onClick={() => markContacted(lead)}
                          disabled={
                            disableMarkContacted ||
                            (lead.status ?? "").toString().toLowerCase() === "contacted" ||
                            markingId === lead.id
                          }
                          title={disableMarkContacted ? contactedHint ?? "Unavailable" : undefined}
                        >
                          {markingId === lead.id ? "Marking..." : "Mark contacted"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Recent Students</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              {loading ? "" : `${recentStudents.length} items`}
            </div>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {loading ? (
              <div style={{ display: "grid", gap: 10 }}>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`st-skel-${idx}`} style={listRowStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={skeletonLineShort} />
                      <div style={{ ...skeletonLineSmall, width: 160, marginTop: 6 }} />
                    </div>
                    <div style={{ width: 90 }}>
                      <div style={skeletonLineSmall} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentStudents.length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={{ fontWeight: 600 }}>No recent students yet</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Add a new student to see them appear here.
                </div>
              </div>
            ) : (
              recentStudents.map((student) => {
                const badge = getBadge(student, recentPaidByStudent);
                return (
                  <div key={student.id} style={listRowStyle}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{studentDisplayName(student)}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                        {student.program ?? "—"} • {money(student.total_fee ?? 0)}
                      </div>
                    </div>
                    <div>
                      <span style={{ ...badgeStyle, ...badgeToneStyle(badge.tone) }}>{badge.label}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const listRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--cardSoft)",
  alignItems: "center",
  flexWrap: "wrap"
};

const quickActionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--text)",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600
};

const markButtonStyle: CSSProperties = {
  marginTop: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "var(--text)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer"
};

const badgeStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.3,
  border: "1px solid transparent"
};

function badgeToneStyle(tone: Badge["tone"]): CSSProperties {
  switch (tone) {
    case "green":
      return { background: "rgba(46, 204, 113, 0.18)", borderColor: "rgba(46, 204, 113, 0.5)", color: "#b6f2cf" };
    case "orange":
      return { background: "rgba(255, 159, 64, 0.18)", borderColor: "rgba(255, 159, 64, 0.55)", color: "#ffd5ad" };
    case "red":
      return { background: "rgba(255, 99, 99, 0.18)", borderColor: "rgba(255, 99, 99, 0.55)", color: "#ffcbcb" };
    case "gray":
    default:
      return { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)", color: "var(--muted)" };
  }
}

function kpiToneStyle(tone?: "good" | "warn" | "danger" | "dangerSoft" | "alert" | "neutral"): CSSProperties {
  switch (tone) {
    case "good":
      return {
        borderColor: "rgba(60, 220, 140, 0.45)",
        boxShadow: "0 0 0 1px rgba(60, 220, 140, 0.12), 0 10px 30px rgba(0, 0, 0, 0.2)"
      };
    case "warn":
      return {
        borderColor: "rgba(255, 179, 92, 0.45)",
        boxShadow: "0 0 0 1px rgba(255, 179, 92, 0.12), 0 10px 30px rgba(0, 0, 0, 0.2)"
      };
    case "danger":
      return {
        borderColor: "rgba(255, 99, 99, 0.55)",
        boxShadow: "0 0 0 1px rgba(255, 99, 99, 0.15), 0 10px 30px rgba(0, 0, 0, 0.2)"
      };
    case "dangerSoft":
      return {
        borderColor: "rgba(255, 120, 120, 0.35)",
        boxShadow: "0 0 0 1px rgba(255, 120, 120, 0.08), 0 10px 28px rgba(0, 0, 0, 0.18)"
      };
    case "alert":
      return {
        borderColor: "rgba(255, 139, 86, 0.5)",
        boxShadow: "0 0 0 1px rgba(255, 139, 86, 0.15), 0 10px 30px rgba(0, 0, 0, 0.2)"
      };
    case "neutral":
    default:
      return {};
  }
}

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12
};

const kpiCardStyle: CSSProperties = {
  padding: 16,
  minHeight: 104,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease"
};

const kpiHoverStyle: CSSProperties = {
  transform: "translateY(-2px)",
  boxShadow: "0 12px 28px rgba(0,0,0,0.25)"
};

const kpiTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.2,
  color: "var(--muted)",
  display: "flex",
  alignItems: "center",
  gap: 6
};

const kpiValueStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  marginTop: 6
};

const kpiSubtitleStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "var(--muted)"
};

const urgentDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "rgba(255, 120, 120, 0.9)",
  boxShadow: "0 0 0 4px rgba(255, 120, 120, 0.15)"
};

const emptyStateStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)"
};

const skeletonBase: CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%)",
  backgroundSize: "200% 100%",
  borderRadius: 999
};

const skeletonLineShort: CSSProperties = {
  ...skeletonBase,
  height: 10,
  width: 90
};

const skeletonLineTall: CSSProperties = {
  ...skeletonBase,
  height: 22,
  width: 120,
  marginTop: 8
};

const skeletonLineSmall: CSSProperties = {
  ...skeletonBase,
  height: 8,
  width: 110
};

