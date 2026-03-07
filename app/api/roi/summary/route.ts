import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function toNumber(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function GET(req: Request) {
  const supabase = getSupabase();
  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  const firmParam = url.searchParams.get("firm") ?? "all";

  const now = new Date();
  const [year, month] = (monthParam ?? "").split("-").map((v) => Number(v));
  const start = month && year ? new Date(year, month - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const monthStart = start.toISOString().slice(0, 10);
  const monthEnd = end.toISOString().slice(0, 10);

  const monthlyQuery = supabase
    .from("roi_entries")
    .select("firm_id,entry_type,amount")
    .gte("entry_date", monthStart)
    .lte("entry_date", monthEnd);

  const lifetimeQuery = supabase
    .from("roi_entries")
    .select("firm_id,entry_type,amount");

  if (firmParam && firmParam !== "all") {
    monthlyQuery.eq("firm_id", firmParam);
    lifetimeQuery.eq("firm_id", firmParam);
  }

  const [monthlyRes, lifetimeRes, firmsRes] = await Promise.all([
    monthlyQuery,
    lifetimeQuery,
    supabase.from("prop_firms").select("id,name")
  ]);

  if (monthlyRes.error || lifetimeRes.error || firmsRes.error) {
    return NextResponse.json(
      { error: monthlyRes.error?.message || lifetimeRes.error?.message || firmsRes.error?.message },
      { status: 400 }
    );
  }

  const firmMap: Record<string, string> = {};
  for (const f of firmsRes.data ?? []) {
    firmMap[f.id] = f.name;
  }

  const sumTotals = (rows: Array<{ entry_type?: string | null; amount?: number | string | null }>) => {
    let spend = 0;
    let payouts = 0;
    for (const row of rows ?? []) {
      const amt = toNumber(row.amount);
      if (row.entry_type === "payout") payouts += amt;
      else spend += amt;
    }
    const net = payouts - spend;
    const roiPct = spend > 0 ? (net / spend) * 100 : null;
    return { spend, payouts, net, roiPct };
  };

  const monthlyTotals = sumTotals(monthlyRes.data ?? []);
  const lifetimeTotals = sumTotals(lifetimeRes.data ?? []);

  const byFirmMap: Record<string, { firm_id: string; firm_name: string; spend: number; payouts: number; net: number; roiPct: number | null }> = {};
  for (const row of (monthlyRes.data ?? []) as Array<{ firm_id?: string | null; entry_type?: string | null; amount?: number | string | null }>) {
    const firmId = row.firm_id;
    if (!firmId) continue;
    if (!byFirmMap[firmId]) {
      byFirmMap[firmId] = {
        firm_id: firmId,
        firm_name: firmMap[firmId] ?? "Unknown",
        spend: 0,
        payouts: 0,
        net: 0,
        roiPct: null
      };
    }
    const amt = toNumber(row.amount);
    if (row.entry_type === "payout") byFirmMap[firmId].payouts += amt;
    else byFirmMap[firmId].spend += amt;
  }
  for (const firmId of Object.keys(byFirmMap)) {
    const f = byFirmMap[firmId];
    f.net = f.payouts - f.spend;
    f.roiPct = f.spend > 0 ? (f.net / f.spend) * 100 : null;
  }

  return NextResponse.json({
    month: monthStart.slice(0, 7),
    firm: firmParam,
    monthlySpend: monthlyTotals.spend,
    monthlyPayouts: monthlyTotals.payouts,
    monthlyNet: monthlyTotals.net,
    monthlyRoiPct: monthlyTotals.roiPct,
    lifetimeSpend: lifetimeTotals.spend,
    lifetimePayouts: lifetimeTotals.payouts,
    lifetimeNet: lifetimeTotals.net,
    lifetimeRoiPct: lifetimeTotals.roiPct,
    byFirm: Object.values(byFirmMap)
  });
}
