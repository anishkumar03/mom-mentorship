import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!
const FROM_EMAIL = 'anish@mindovermarkets.net'
const FROM_NAME = 'Anish — MOM Mentorship'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || JSON.stringify(data))
  return data
}

function groupEmailHtml(vars: {
  firstName: string
  batchName: string
  startDate: string
  endDate: string
  fee: string
  paymentDeadline: string
  zoomLink: string
  sessionDay: string
  sessionTime: string
  sessions: { session_number: number; session_date: string; status: string }[]
}) {
  const { firstName, batchName, startDate, endDate, fee, paymentDeadline, zoomLink, sessionDay, sessionTime, sessions } = vars
  const activeSessions = sessions.filter(s => s.status !== 'skipped')
  const durationLabel = activeSessions.length ? `${activeSessions.length} Sessions` : '7 Weeks'
  const scheduleTableRow = activeSessions.length
    ? ''
    : `<tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Schedule</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">Every ${sessionDay}</td></tr>`
  const sessionScheduleBlock = activeSessions.length
    ? `<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">Session Schedule</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
${activeSessions.map(s => `Session ${s.session_number} — ${formatDate(s.session_date)}`).join('<br/>\n')}
</p>`
    : ''
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
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 6px;"><strong>Canada</strong> — Interac e-Transfer to anish@mindovermarkets.net<br/><strong>Outside Canada</strong> — <a href="https://wise.com/pay/me/anishm11" style="color:#d4a832;">wise.com/pay/me/anishm11</a></p>
<p style="font-size:13px;color:#dc2626;margin:0 0 24px;">Please complete payment before ${paymentDeadline} and include your full name in the transfer message. Payment is non-refundable. Limited to 10 seats.</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">If you have any questions, simply reply to this email and I will personally guide you through the next steps.</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0;">Let's make these 7 weeks a powerful turning point in your trading journey.<br/><br/>Warm regards,<br/><strong style="color:#0a1628;">Anish Kumar Pillai</strong><br/>Mind Over Markets<br/><a href="mailto:anish@mindovermarkets.net" style="color:#d4a832;">anish@mindovermarkets.net</a><br/>+1 (613) 701-4597</p>
</td></tr>
<tr><td style="background:#0a1628;padding:20px 40px;text-align:center;">
<p style="font-size:12px;color:#64748b;margin:0;">Mind Over Markets &nbsp;&bull;&nbsp; <a href="mailto:anish@mindovermarkets.net" style="color:#d4a832;text-decoration:none;">anish@mindovermarkets.net</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function oneOnOneEmailHtml(vars: { firstName: string; fee: string }) {
  const { firstName, fee } = vars
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
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 16px;">Welcome to the <strong>Mind Over Markets 1-on-1 Mentorship Program!</strong> I am genuinely excited to work with you personally over the next 7 weeks. This program is fully tailored around your goals, your questions, and your specific challenges as a trader.</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">I will reach out personally within the next 24 hours to schedule our first session and get you set up.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
<tr style="background:#fafafa;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;width:40%;">Duration</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">7 Weeks</td></tr>
<tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Sessions</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">1 to 2 per Week</td></tr>
<tr style="background:#fafafa;"><td style="padding:10px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Format</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #e5e7eb;">Live Zoom + Private Discord</td></tr>
<tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Program Fee</td><td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;">${fee}</td></tr>
</table>
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">What's Included</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
&bull; 7 weeks of personalized mentorship built around your specific needs<br/>
&bull; Foundational Market Knowledge — how markets operate and price movement<br/>
&bull; Introduction to Futures — mechanics, key concepts, and professional setup<br/>
&bull; Trade Execution Process — step-by-step discipline before, during, and after each trade<br/>
&bull; My Unique Strategy and Edge using Smart Money Concepts (SMC) adapted to your style<br/>
&bull; Private Discord group for trade ideas, chart sharing, and direct Q&A<br/>
&bull; Feedback and discussion on your charts between sessions<br/>
&bull; Daily trade journal access to track and refine your performance<br/>
&bull; Post-mentorship support to continue your growth after the program
</p>
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">Mentorship Modules</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
1. Understanding Charts, Candlesticks and Market Structure<br/>
2. Futures Market Fundamentals and Introduction to Liquidity Concepts<br/>
3. Smart Money Concepts — Order Blocks and Fair Value Gaps (FVG)<br/>
4. Strategy Deep Dive — FVG Trading Strategy<br/>
5. Strategy Deep Dive — Inverse FVG (iFVG) Strategy<br/>
6. Risk Management, Position Sizing, Prop Firm Strategies and Trading Psychology
</p>
<p style="font-size:14px;font-weight:700;color:#0a1628;margin:0 0 10px;">Community and Ongoing Support</p>
<p style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;">
&bull; Private Discord group for trade ideas, chart sharing, and Q&A<br/>
&bull; Chart feedback and discussion between sessions<br/>
&bull; Post-mentorship support after the program ends
</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">If you have any questions before we connect, simply reply to this email. I read every message personally and will get back to you quickly.</p>
<p style="font-size:14px;color:#374151;line-height:1.8;margin:0;">Let's make these 7 weeks a powerful turning point in your trading journey.<br/><br/>Warm regards,<br/><strong style="color:#0a1628;">Anish Kumar Pillai</strong><br/>Mind Over Markets<br/><a href="mailto:anish@mindovermarkets.net" style="color:#d4a832;">anish@mindovermarkets.net</a><br/>+1 647-687-3758</p>
</td></tr>
<tr><td style="background:#0a1628;padding:20px 40px;text-align:center;">
<p style="font-size:12px;color:#64748b;margin:0;">Mind Over Markets &nbsp;&bull;&nbsp; <a href="mailto:anish@mindovermarkets.net" style="color:#d4a832;text-decoration:none;">anish@mindovermarkets.net</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, batchKey, name } = body

    if (!email || !batchKey) {
      return NextResponse.json(
        { error: 'Missing email or batchKey' },
        { status: 400 }
      )
    }

    const { data: batches, error: batchErr } = await supabase
      .from('email_batches')
      .select('*')
      .eq('batch_key', batchKey.toLowerCase())
      .limit(1)

    if (batchErr) {
      return NextResponse.json({ error: batchErr.message }, { status: 500 })
    }

    if (!batches || batches.length === 0) {
      return NextResponse.json(
        { error: `No batch found with key: ${batchKey}` },
        { status: 404 }
      )
    }

    const batch = batches[0]

    // Use provided name first, then try student record, fallback to email
    let firstName = 'there'

    if (name) {
      firstName = (name || 'there').split(' ')[0]
    } else {
      // Try to get student name if not provided
      const { data: students } = await supabase
        .from('students')
        .select('full_name, name')
        .ilike('email', email.toLowerCase())
        .limit(1)

      if (students && students.length > 0) {
        firstName = (students[0].full_name || students[0].name || 'there').split(' ')[0]
      }
    }

    let html: string
    let subject: string

    if (batch.type === 'group') {
      const { data: batchSessions } = await supabase
        .from('batch_sessions')
        .select('session_number, session_date, status')
        .eq('batch_id', batch.id)
        .order('session_number')

      subject = `Welcome to ${batch.batch_name} — MOM Mentorship`
      html = groupEmailHtml({
        firstName,
        batchName: batch.batch_name,
        startDate: formatDate(batch.start_date),
        endDate: formatDate(batch.end_date),
        fee: batch.fee,
        paymentDeadline: batch.payment_deadline ? formatDate(batch.payment_deadline) : 'TBD',
        zoomLink: batch.zoom_link || '#',
        sessionDay: batch.session_day || 'Wednesday',
        sessionTime: batch.session_time || '7:00 PM – 9:00 PM ET',
        sessions: batchSessions || [],
      })
    } else {
      subject = `Welcome to MOM 1-on-1 Mentorship, ${firstName}`
      html = oneOnOneEmailHtml({ firstName, fee: batch.fee })
    }

    await sendEmail(email, subject, html)

    return NextResponse.json({
      success: true,
      message: `Email sent to ${firstName} (${email})`,
    })
  } catch (error: any) {
    console.error('Send batch email error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}
