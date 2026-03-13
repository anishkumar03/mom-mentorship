import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/leads/webhook
 *
 * Accepts lead data from external sources (Google Forms, Instagram, etc.)
 * and inserts it into the leads table.
 *
 * Headers:
 *   x-api-key: <your LEADS_WEBHOOK_KEY env var>
 *
 * Body (JSON):
 *   full_name  - string (required)
 *   phone      - string (optional)
 *   email      - string (optional)
 *   source     - string (optional, e.g. "Instagram", "Google Forms")
 *   handle     - string (optional, Instagram handle)
 *   notes      - string (optional)
 *   program    - string (optional)
 */
export async function POST(req: NextRequest) {
  // --- Auth ---
  const apiKey = process.env.LEADS_WEBHOOK_KEY;
  if (apiKey) {
    const provided = req.headers.get("x-api-key") ?? "";
    if (provided !== apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // --- Parse body ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fullName = String(body.full_name ?? body.name ?? "").trim();
  if (!fullName) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim() || null;
  const email = String(body.email ?? "").trim() || null;
  const source = String(body.source ?? "").trim() || null;
  const handle = String(body.handle ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const program = String(body.program ?? "").trim() || null;

  // --- Check for duplicates (same name + same phone or email) ---
  if (phone || email) {
    let dupQuery = supabase
      .from("leads")
      .select("id")
      .ilike("full_name", fullName);

    if (phone) dupQuery = dupQuery.eq("phone", phone);
    else if (email) dupQuery = dupQuery.ilike("email", email);

    const { data: existing } = await dupQuery.limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { ok: true, message: "Lead already exists", lead_id: existing[0].id, duplicate: true },
        { status: 200 }
      );
    }
  }

  // --- Insert ---
  const payload: Record<string, unknown> = {
    full_name: fullName,
    phone,
    email,
    source,
    handle,
    notes,
    program,
    status: "New",
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("Webhook lead insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_id: data.id }, { status: 201 });
}

// Health check
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "leads-webhook" });
}
