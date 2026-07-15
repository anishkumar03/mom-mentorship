// supabase/functions/welcome-email/index.ts
//
// Fired by a Supabase Database Webhook on `leads` AFTER INSERT (Database ->
// Webhooks -> table: leads, events: INSERT, type: Supabase Edge Functions,
// function: welcome-email). The webhook call is fire-and-forget from
// Postgres's perspective, so a slow/failed send here never blocks or rolls
// back the lead insert itself.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND    = Deno.env.get("RESEND_API_KEY")!;
// Distinct from dispatch-processor's FROM_EMAIL/FROM_NAME (anish@...) since
// this is the lead-facing address, not the personal session-dispatch one.
const FROM_EMAIL = Deno.env.get("WELCOME_FROM_EMAIL") ?? "hello@mindovermarkets.net";
const FROM_NAME  = Deno.env.get("WELCOME_FROM_NAME")  ?? "Mind Over Markets";

function programLabel(program: string | null | undefined): string {
  const p = (program ?? "").trim().toLowerCase();
  if (p.includes("1-on-1") || p.includes("one-on-one") || p.includes("1on1") || p.includes("private")) {
    return "One-on-One Mentorship";
  }
  return "Group Mentorship";
}

function welcomeEmailHtml(firstName: string, programName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body style="margin:0;padding:0;background:#f0f0f5;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;border-radius:14px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#07091A,#1a1f3e);padding:36px 32px;text-align:center">
    <p style="color:#D4A843;font-size:11px;letter-spacing:3px;margin:0 0 10px">MIND OVER MARKETS</p>
    <h1 style="color:#fff;font-size:20px;margin:0">Application Received</h1>
  </div>
  <div style="background:#fff;padding:36px 32px">
    <p style="color:#1a1f3e;font-size:16px">Hi ${firstName},</p>
    <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 16px">Welcome to the Mind Over Markets Trading Mentorship Program — we're excited to have you here! 🎉</p>
    <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 20px">Your application for the <strong style="color:#1a1f3e">${programName}</strong> has been received successfully.</p>
    <p style="color:#1a1f3e;font-size:14px;font-weight:700;margin:0 0 10px">Here's what happens next</p>
    <p style="color:#555;line-height:1.9;font-size:14px;margin:0 0 20px">
      &bull; Within the next couple of days, you'll receive an email with the class details, payment information, and your joining link.<br/>
      &bull; Once payment is confirmed, you'll get access to the sessions, resources, and our community.
    </p>
    <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 16px">In the meantime, keep an eye on your inbox (and spam folder, just in case).</p>
    <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 24px">If you have any questions, just reply to this email.</p>
    <p style="color:#1a1f3e;font-size:14px;margin:0">Talk soon,<br><strong>Anish</strong><br><span style="color:#aaa;font-size:12px">Mind Over Markets</span></p>
  </div>
</div></body></html>`;
}

async function sendResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: d.message ?? JSON.stringify(d) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  // Standard Supabase Database Webhook payload shape: { type, table, record, old_record, schema }
  const lead = payload?.record;
  if (!lead?.id) return new Response("Missing record.id", { status: 400 });

  const email = String(lead.email ?? "").trim().toLowerCase();
  if (!email) return new Response(JSON.stringify({ ok: true, skipped: "no_email" }), { status: 200 });

  const firstName = (String(lead.full_name ?? lead.name ?? "").trim().split(/\s+/)[0]) || "there";
  const programName = programLabel(lead.program);

  // Dedup: if this email already has a successfully-sent welcome email on a
  // different lead row (e.g. they submitted the apply form twice), skip.
  const { data: dupes } = await sb
    .from("leads")
    .select("id")
    .ilike("email", email)
    .eq("welcome_email_status", "sent")
    .neq("id", lead.id)
    .limit(1);

  if (dupes && dupes.length > 0) {
    await sb.from("leads").update({
      welcome_email_status: "skipped_duplicate",
      welcome_email_sent_at: new Date().toISOString(),
      welcome_email_error: null,
    }).eq("id", lead.id);
    return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), { status: 200 });
  }

  const subject = "Welcome to Mind Over Markets — Application Received ✅";
  const html = welcomeEmailHtml(firstName, programName);
  const result = await sendResend(email, subject, html);

  await sb.from("leads").update({
    welcome_email_status: result.ok ? "sent" : "failed",
    welcome_email_sent_at: new Date().toISOString(),
    welcome_email_error: result.ok ? null : (result.error ?? "Unknown error"),
  }).eq("id", lead.id);

  return new Response(JSON.stringify({ ok: result.ok, error: result.error }), { status: result.ok ? 200 : 500 });
});
