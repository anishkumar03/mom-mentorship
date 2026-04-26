import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const NOTIFY_EMAIL = "anish@mindovermarkets.net";

const EXPERIENCE_LABELS: Record<string, string> = {
  less_1:  "Less than 1 year",
  "1_3":   "1–3 years",
  "3_5":   "3–5 years",
  "5_plus":"5+ years",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Supabase webhook sends { type, table, record, old_record }
    const record = body.record || body;

    if (!record || !record.full_name) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const html = `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A1628;color:#E8E0CE;border-radius:12px;overflow:hidden;border:1px solid rgba(201,168,76,0.2);">
        
        <!-- Header -->
        <div style="background:#0E1E38;border-bottom:1px solid rgba(201,168,76,0.3);padding:24px 28px;">
          <table cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
            <tr>
              <td style="width:36px;height:36px;background:#C9A84C;border-radius:50%;text-align:center;vertical-align:middle;">
                <span style="color:#0A1628;font-weight:700;font-size:18px;font-family:Georgia,serif;">M</span>
              </td>
              <td style="padding-left:10px;color:#C9A84C;font-weight:700;letter-spacing:0.06em;font-size:14px;text-transform:uppercase;">
                Mind Over Markets
              </td>
            </tr>
          </table>
          <h1 style="color:#E8E0CE;font-size:20px;margin:0;font-weight:700;">
            🎯 New Mentorship Application
          </h1>
        </div>

        <!-- Body -->
        <div style="padding:24px 28px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);color:rgba(232,224,206,0.5);font-size:12px;width:40%;">Name</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);font-size:14px;font-weight:600;color:#E8E0CE;">${record.full_name}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);color:rgba(232,224,206,0.5);font-size:12px;">Experience</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);font-size:14px;color:#E8E0CE;">${EXPERIENCE_LABELS[record.experience] || record.experience || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);color:rgba(232,224,206,0.5);font-size:12px;">Challenge</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);font-size:14px;color:#E8E0CE;">${record.challenge || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);color:rgba(232,224,206,0.5);font-size:12px;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);font-size:14px;color:#E8E0CE;">${record.email || "—"}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);color:rgba(232,224,206,0.5);font-size:12px;">Phone</td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,0.1);font-size:14px;color:#E8E0CE;">${record.phone || "—"}</td>
            </tr>
            ${record.challenge_detail ? `
            <tr>
              <td style="padding:10px 0;color:rgba(232,224,206,0.5);font-size:12px;vertical-align:top;">Their Story</td>
              <td style="padding:10px 0;font-size:13px;line-height:1.6;color:rgba(232,224,206,0.8);">${record.challenge_detail}</td>
            </tr>` : ""}
          </table>

          <!-- CTA Button -->
          <div style="margin-top:28px;text-align:center;">
            <a href="https://mom-mentorship.vercel.app/applications"
               style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.03em;">
              View in CRM →
            </a>
          </div>

          <p style="margin-top:24px;font-size:11px;color:rgba(232,224,206,0.25);text-align:center;">
            Sent automatically from your Mind Over Markets apply page
          </p>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    "Mind Over Markets <onboarding@resend.dev>",
        to:      ["anishkumar03@gmail.com"],
        subject: `🎯 New Application — ${record.full_name}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Notify error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
