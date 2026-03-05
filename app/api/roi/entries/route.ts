import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

type EntryRow = {
  id: string;
  firm_id: string;
  entry_date: string | null;
  entry_type: string | null;
  amount: number | string | null;
  category?: string | null;
  description?: string | null;
  notes?: string | null;
  created_at?: string | null;
  prop_firms?: { name?: string | null } | { name?: string | null }[] | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  const firmParam = url.searchParams.get("firm") ?? "all";
  const typeParam = url.searchParams.get("type") ?? "all";

  let query = supabase
    .from("roi_entries")
    .select("id,firm_id,entry_date,entry_type,amount,category,description,notes,created_at,prop_firms(name)")
    .order("created_at", { ascending: false });

  if (monthParam) {
    const [year, month] = monthParam.split("-").map((v) => Number(v));
    if (year && month) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      const startIso = start.toISOString().slice(0, 10);
      const endIso = end.toISOString().slice(0, 10);
      query = query.gte("entry_date", startIso).lte("entry_date", endIso);
    }
  }
  if (firmParam && firmParam !== "all") {
    query = query.eq("firm_id", firmParam);
  }
  if (typeParam && typeParam !== "all") {
    query = query.eq("entry_type", typeParam);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []).map((row: EntryRow) => {
    const firmName = Array.isArray(row.prop_firms)
      ? row.prop_firms[0]?.name ?? null
      : row.prop_firms?.name ?? null;
    return {
    id: row.id,
    firm_id: row.firm_id,
    firm_name: firmName,
    entry_date: row.entry_date,
    entry_type: row.entry_type,
    amount: toNumber(row.amount),
    category: row.category ?? null,
    description: row.description ?? "",
    notes: row.notes ?? null,
    created_at: row.created_at
    };
  });

  return NextResponse.json({ entries: rows });
}
