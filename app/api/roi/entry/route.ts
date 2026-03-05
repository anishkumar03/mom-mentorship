import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const entryType = body.entry_type === "payout" ? "payout" : "expense";
    const payload = {
      firm_id: body.firm_id ?? null,
      entry_date: body.entry_date ?? new Date().toISOString().slice(0, 10),
      entry_type: entryType,
      amount: Number(body.amount ?? 0),
      category: body.category ?? null,
      description: body.description ?? null,
      notes: body.notes ?? null
    };

    if (!payload.firm_id) {
      return NextResponse.json({ error: "firm_id is required" }, { status: 400 });
    }
    if (!payload.description || !String(payload.description).trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (!Number.isFinite(payload.amount) || payload.amount < 0) {
      return NextResponse.json({ error: "amount must be >= 0" }, { status: 400 });
    }

    const { error } = await supabase.from("roi_entries").insert(payload);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
