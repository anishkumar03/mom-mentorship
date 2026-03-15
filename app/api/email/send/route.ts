import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/email/send
 *
 * Sends an email via Resend and updates the email_drafts record.
 *
 * Body (JSON):
 *   draft_id   - uuid (optional, to update existing draft status)
 *   lead_id    - uuid (optional, to link to a lead)
 *   to         - string (required, recipient email)
 *   to_name    - string (optional, recipient name)
 *   subject    - string (required)
 *   body       - string (required, plain text or HTML body)
 *   from_email - string (optional, defaults to RESEND_FROM_EMAIL env var)
 */
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = String(payload.to ?? "").trim();
  const toName = String(payload.to_name ?? "").trim() || null;
  const subject = String(payload.subject ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const draftId = String(payload.draft_id ?? "").trim() || null;
  const leadId = String(payload.lead_id ?? "").trim() || null;
  const fromEmail =
    String(payload.from_email ?? "").trim() ||
    process.env.RESEND_FROM_EMAIL ||
    "";

  if (!to) {
    return NextResponse.json({ error: "to (email) is required" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured. Add it to your environment variables." },
      { status: 500 }
    );
  }
  if (!fromEmail) {
    return NextResponse.json(
      { error: "RESEND_FROM_EMAIL is not configured. Add it to your environment variables." },
      { status: 500 }
    );
  }

  const resend = new Resend(resendKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toName ? `${toName} <${to}>` : to,
      subject,
      html: body.includes("<") ? body : `<p>${body.replace(/\n/g, "<br/>")}</p>`,
    });

    if (error) {
      // Update draft as failed
      if (draftId) {
        await supabase
          .from("email_drafts")
          .update({ status: "failed", error_message: error.message, updated_at: new Date().toISOString() })
          .eq("id", draftId);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update draft as sent (or create one for record-keeping)
    if (draftId) {
      await supabase
        .from("email_drafts")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);
    } else {
      // Create a sent record
      await supabase.from("email_drafts").insert({
        lead_id: leadId,
        to_email: to,
        to_name: toName,
        subject,
        body,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    // Also update lead's last_contacted_at
    if (leadId) {
      await supabase
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", leadId);
    }

    return NextResponse.json({ ok: true, email_id: data?.id ?? null }, { status: 200 });
  } catch (err: any) {
    if (draftId) {
      await supabase
        .from("email_drafts")
        .update({ status: "failed", error_message: err.message, updated_at: new Date().toISOString() })
        .eq("id", draftId);
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
