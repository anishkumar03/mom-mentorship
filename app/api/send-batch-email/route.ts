import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const groupEmailHtml = (
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
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
    .content { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .batch-info { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${batchName}</h1>
      <p>Your trading mentorship starts now!</p>
    </div>

    <div class="content">
      <p>Hi ${studentName},</p>

      <p>Welcome to the <strong>${batchName}</strong> group! We're excited to have you as part of our community.</p>

      <div class="batch-info">
        <strong>Batch Key:</strong> <code>${batchKey}</code><br>
        <strong>Batch:</strong> ${batchName}
      </div>

      <p>This group is designed to help you learn professional trading strategies in a structured mentorship program. You'll have access to daily market analysis, trading setups, and direct mentorship from experienced traders.</p>

      <p>Get started by:</p>
      <ul>
        <li>Reviewing the course materials in your dashboard</li>
        <li>Joining our daily trading analysis sessions</li>
        <li>Connecting with other members in the group</li>
      </ul>

      <p>If you have any questions, feel free to reach out. We're here to help you succeed!</p>

      <p>Happy trading!</p>
      <p><strong>Mind Over Markets Team</strong></p>
    </div>

    <div class="footer">
      <p>© 2026 Mind Over Markets. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

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
    const emailHtml = isOneOnOne
      ? oneOnOneEmailHtml(firstName, batch.batch_key, batch.batch_name)
      : groupEmailHtml(firstName, batch.batch_key, batch.batch_name);

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
