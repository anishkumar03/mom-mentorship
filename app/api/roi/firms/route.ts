import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const baseQuery = supabase
      .from("prop_firms")
      .select("id,name,platform,account_size,profit_split_pct,created_at")
      .order("created_at", { ascending: true });

    const { data, error } = await baseQuery;
    if (!error) {
      return NextResponse.json({ firms: data ?? [] });
    }

    if (String(error.message).toLowerCase().includes("profit_split_pct")) {
      const fallback = await supabase
        .from("prop_firms")
        .select("id,name,platform,account_size,created_at")
        .order("created_at", { ascending: true });
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 400 });
      }
      return NextResponse.json({ firms: fallback.data ?? [] });
    }

    return NextResponse.json({ error: error.message }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load firms";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const payload = {
      name,
      platform: body?.platform ? String(body.platform).trim() : null,
      account_size: body?.account_size === "" ? null : Number(body?.account_size),
      profit_split_pct: body?.profit_split_pct === "" ? null : Number(body?.profit_split_pct)
    };

    if (payload.account_size != null && !Number.isFinite(payload.account_size)) {
      return NextResponse.json({ error: "account_size must be a number" }, { status: 400 });
    }
    if (payload.profit_split_pct != null && (!Number.isFinite(payload.profit_split_pct) || payload.profit_split_pct < 0 || payload.profit_split_pct > 100)) {
      return NextResponse.json({ error: "profit_split_pct must be between 0 and 100" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("prop_firms")
      .insert(payload)
      .select("id,name,platform,account_size,profit_split_pct,created_at")
      .single();

    if (!error) {
      return NextResponse.json({ firm: data });
    }

    if (String(error.message).toLowerCase().includes("profit_split_pct")) {
      const fallbackPayload = {
        name,
        platform: payload.platform,
        account_size: payload.account_size
      };
      const fallback = await supabase
        .from("prop_firms")
        .insert(fallbackPayload)
        .select("id,name,platform,account_size,created_at")
        .single();
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 400 });
      }
      return NextResponse.json({ firm: fallback.data });
    }

    return NextResponse.json({ error: error.message }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
