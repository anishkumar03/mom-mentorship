import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const groupEmailHtml = (vars: any) => {
  const {
    firstName,
    batchName,
    startDate,
    endDate,
    fee,
    paymentDeadline,
    zoomLink,
    sessionDay,
    sessionTime,
    sessions,
  } = vars;

  const activeSessions = sessions?.filter((s: any) => s.status !== "skipped") || [];
  const durationLabel = activeSessions.length ? `${activeSessions.length} Sessions` : "7 Weeks";
  const scheduleTableRow =
    activeSessions.length
      ? ""
      : `<tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Schedule</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">Every ${sessionDay}</td></tr>`;

  const sessionScheduleBlock =
    activeSessions.length
      ? `<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">Session Schedule</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
${activeSessions.map((s: any) => `Session ${s.session_number} — ${new Date(s.session_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`).join("<br/>\n")}
</p>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:#0a1628;padding:28px 40px;text-align:center;">
<img src="https://mom-mentorship.vercel.app/logo.png" alt="Mind Over Markets" width="180" style="display:block;margin:0 auto;max-width:180px;"/>
</td></tr>
<tr><td style="background:#d4a832;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:36px 40px;">
<p style="font-size:16px;font-weight:700;color:#0a1628;margin:0 0 20px;">Hi ${firstName},</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 16px;">Welcome to the <strong>Mind Over Markets Group Mentorship Program!</strong> I am excited to have you join us. Our next batch — <strong>${batchName}</strong> — officially starts on <strong>${startDate}</strong> and runs until <strong>${endDate}</strong>.</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">This is a structured 7-week program designed for traders who want to build discipline, clarity, confidence, and a deeper understanding of the markets.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
<tr style="background:#fafafa;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;width:40%;">Duration</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">${durationLabel}</td></tr>
${scheduleTableRow}
<tr style="background:#fafafa;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Time</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">${sessionTime}</td></tr>
<tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Format</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">Live Zoom + Private Discord</td></tr>
<tr style="background:#fafafa;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Program Fee</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;">${fee}</td></tr>
</table>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 6px;"><strong>Zoom Join Link:</strong></p>
<p style="margin:0 0 24px;"><a href="${zoomLink}" style="color:#d4a832;font-size:14px;">${zoomLink}</a></p>
${sessionScheduleBlock}
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">What's Included</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
&bull; 7 weeks of structured mentorship with live guidance<br/>
&bull; Foundational Market Knowledge and price movement concepts<br/>
&bull; Introduction to Futures Trading — mechanics and professional setup<br/>
&bull; Trade Execution Process — discipline before, during, and after each trade<br/>
&bull; My Unique Strategy and Edge using Smart Money Concepts (SMC)<br/>
&bull; Private Discord community for chart sharing, trade discussions, and Q&A<br/>
&bull; Daily trade journal access to track and refine your performance<br/>
&bull; Post-mentorship Q&A support to continue your growth<br/>
&bull; All sessions recorded and shared exclusively with enrolled students
</p>
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">Mentorship Modules</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
1. The Truth About Trading and Mastering the Trading Mindset<br/>
2. Understanding Charts, Candlesticks and Market Structure<br/>
3. Futures Market Fundamentals and Introduction to Liquidity Concepts<br/>
4. Smart Money Concepts — Order Blocks and Fair Value Gaps (FVG)<br/>
5. Strategy Deep Dive — FVG Trading Strategy<br/>
6. Strategy Deep Dive — Inverse FVG (iFVG) Strategy<br/>
7. Risk Management, Position Sizing, Prop Firm Strategies and Trading Psychology
</p>
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">Session Format</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">Each session includes approximately 1 hour 30 minutes of teaching, followed by a 20 to 30 minute Q&A. All sessions are recorded and shared exclusively with enrolled students.</p>
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">How to Prepare</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
&bull; Join from a quiet place with a stable internet connection<br/>
&bull; Bring a notebook and pen for taking notes<br/>
&bull; Join 5 minutes early so we can start on time
</p>
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">Payment</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 6px;"><strong>Canada</strong> — Interac e-Transfer to anish@mindovermarkets.net<br/><strong>Outside Canada</strong> — <a href="https://buy.stripe.com/bJebJ04IB0866mq1I65Rm00" style="color:#d4a832;">Pay with Stripe</a></p>
<p style="font-size:13px;color:#6b7280;margin:12px 0;"><strong>Payment Deadline:</strong> ${paymentDeadline}</p>
<p style="font-size:14px;color:#374151;margin:24px 0 0;">I'm excited to share my knowledge with you and help you become a disciplined, confident trader. Let's get started!</p>
<p style="font-size:14px;color:#374151;margin:12px 0 0;"><strong>All the best,</strong><br/>Anish</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;font-size:12px;color:#6b7280;">© 2026 Mind Over Markets. All rights reserved.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
};

const oneOnOneEmailHtml = (
  studentName: string,
  batchKey: string,
  batchName: string
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
    .content { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .batch-info { background: white; padding: 15px; border-left: 4px solid #f5576c; margin: 15px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to 1-on-1 Mentorship</h1>
      <p>Your personalized trading journey starts here</p>
    </div>

    <div class="content">
      <p>Hi ${studentName},</p>

      <p>Thank you for enrolling in our 1-on-1 mentorship program. We're thrilled to work with you one-on-one to accelerate your trading journey.</p>

      <div class="batch-info">
        <strong>Batch Key:</strong> <code>${batchKey}</code><br>
        <strong>Program:</strong> ${batchName}
      </div>

      <p>As a 1-on-1 mentee, you'll receive:</p>
      <ul>
        <li>Personalized trading strategy guidance</li>
        <li>Weekly 1-on-1 mentoring sessions</li>
        <li>Custom trade analysis and feedback</li>
        <li>Direct access to your mentor</li>
      </ul>

      <p>Your dedicated mentor will be in touch soon to schedule your first session and discuss your trading goals.</p>

      <p>Looking forward to working with you!</p>
      <p><strong>Mind Over Markets Team</strong></p>
    </div>

    <div class="footer">
      <p>© 2026 Mind Over Markets. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { email, batchKey, name } = await request.json();

    if (!email || !batchKey) {
      return NextResponse.json(
        { error: "Missing email or batchKey" },
        { status: 400 }
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("email_batches")
      .select("*")
      .eq("batch_key", batchKey)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    let firstName = name ? name.split(" ")[0] : email.split("@")[0];

    try {
      const { data: student } = await supabase
        .from("students")
        .select("full_name")
        .eq("email", email)
        .single();

      if (student?.full_name) {
        firstName = student.full_name.split(" ")[0];
      }
    } catch (e) {
      // Student not found, use name or email handle
    }

    const isOneOnOne = batch.batch_type === "1-on-1";
    let emailHtml = "";

    if (isOneOnOne) {
      emailHtml = oneOnOneEmailHtml(firstName, batch.batch_key, batch.batch_name);
    } else {
      // Fetch sessions for this batch
      const { data: sessions } = await supabase
        .from("sessions")
        .select("*")
        .eq("batch_id", batch.id)
        .order("session_number");

      const emailVars = {
        firstName,
        batchName: batch.batch_name,
        startDate: batch.start_date ? new Date(batch.start_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "",
        endDate: batch.end_date ? new Date(batch.end_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "",
        fee: batch.fee || "$1000 CAD",
        paymentDeadline: batch.payment_deadline ? new Date(batch.payment_deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "",
        zoomLink: batch.zoom_link || "https://zoom.us",
        sessionDay: batch.session_day || "Wednesday",
        sessionTime: batch.session_time || "7:00 PM - 9:00 PM ET",
        sessions: sessions || [],
      };
      emailHtml = groupEmailHtml(emailVars);
    }

    await resend.emails.send({
      from: "anish@mindovermarkets.net",
      to: email,
      subject: `Welcome to ${batch.batch_name}`,
      html: emailHtml,
    });

    const { error: updateError } = await supabase
      .from("leads")
      .update({ batch_sent_at: new Date().toISOString() })
      .eq("email", email);

    if (updateError) {
      console.error("Error updating lead:", updateError);
      return NextResponse.json(
        { error: "Email sent but failed to update lead record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send batch email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
