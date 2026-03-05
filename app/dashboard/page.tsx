import { redirect } from "next/navigation";

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
  redirect("/leads");
}
