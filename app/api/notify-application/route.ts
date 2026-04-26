import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner (less than 1 year)",
  "1_3": "1-3 years",
  "3_5": "3-5 years",
  "5_plus": "5+ years",
};

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Supabase webhook sends { type, table, record, ... }
  const record = (payload.record ?? payload) as Record<string, string | null>;

  const fullName = record.full_name ?? "Unknown";
  const email = record.email ?? "Not provided";
  const phone = record.phone ?? "Not provided";
  const experience = record.experience ?? "Not provided";
  const challenge = record.challenge ?? "Not provided";

  const experienceLabel = EXPERIENCE_LABELS[experience] ?? experience;

  const resend = new Resend(resendKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Mind Over Markets <notifications@mindovermarkets.net>",
      to: "anish@mindovermarkets.net",
      subject: `New Mentorship Application: ${fullName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a2e; border-bottom: 2px solid #3b82f6; padding-bottom: 12px;">
            New Mentorship Application
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 10px 12px; font-weight: 600; color: #555; width: 140px; border-bottom: 1px solid #eee;">Name</td>
              <td style="padding: 10px 12px; color: #1a1a2e; border-bottom: 1px solid #eee;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: 600; color: #555; border-bottom: 1px solid #eee;">Email</td>
              <td style="padding: 10px 12px; color: #1a1a2e; border-bottom: 1px solid #eee;">
                <a href="mailto:${email}" style="color: #3b82f6;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: 600; color: #555; border-bottom: 1px solid #eee;">Phone</td>
              <td style="padding: 10px 12px; color: #1a1a2e; border-bottom: 1px solid #eee;">
                <a href="tel:${phone}" style="color: #3b82f6;">${phone}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: 600; color: #555; border-bottom: 1px solid #eee;">Experience</td>
              <td style="padding: 10px 12px; color: #1a1a2e; border-bottom: 1px solid #eee;">${experienceLabel}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; font-weight: 600; color: #555; border-bottom: 1px solid #eee;">Challenge</td>
              <td style="padding: 10px 12px; color: #1a1a2e; border-bottom: 1px solid #eee;">${challenge}</td>
            </tr>
          </table>
          <p style="margin-top: 24px; font-size: 13px; color: #888;">
            This notification was sent automatically from the Mind Over Markets CRM.
          </p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
