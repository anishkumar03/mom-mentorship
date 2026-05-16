// app/api/telegram/route.ts
// Next.js App Router API route

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN!
const TELEGRAM_API    = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`
const RESEND_API_KEY  = process.env.RESEND_API_KEY!
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_USER_ID!)
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY!
const FROM_EMAIL      = 'anish@mindovermarkets.net'
const FROM_NAME       = 'Anish — MOM Mentorship'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

async function sendTelegram(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
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

// ── Email Templates ───────────────────────────────────────────────────────
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
}) {
  const { firstName, batchName, startDate, endDate, fee, paymentDeadline, zoomLink, sessionDay, sessionTime } = vars
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:Arial,sans-serif; }
    .wrap { max-width:580px; margin:40px auto; background:#fff; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0; }
    .eh { background:#0a1628; padding:36px 40px; text-align:center; }
    .logo { color:#d4a832; font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; margin-bottom:10px; }
    .eh h1 { color:#fff; font-size:26px; font-weight:700; margin:0; line-height:1.35; }
    .eh h1 em { color:#d4a832; font-style:normal; }
    .eh-sub { color:#94a3b8; font-size:13px; margin-top:10px; }
    .eb { padding:32px 40px; }
    .greet { font-size:17px; font-weight:700; color:#0a1628; margin-bottom:14px; }
    p { color:#475569; font-size:14px; line-height:1.75; margin-bottom:14px; }
    .highlight { background:#fdf8ec; border-left:3px solid #d4a832; border-radius:0 8px 8px 0; padding:14px 18px; margin:20px 0; }
    .highlight p { color:#78540a; margin:0; font-weight:500; }
    .sec { font-size:12px; font-weight:700; color:#0a1628; letter-spacing:.08em; text-transform:uppercase; margin:24px 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:7px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:14px 0; }
    .cell { background:#f8fafc; border-radius:8px; padding:12px 14px; border:.5px solid #e2e8f0; }
    .cell-label { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
    .cell-val { font-size:13px; font-weight:600; color:#0a1628; }
    .zoom-btn { display:block; background:#0a1628; color:#d4a832; text-align:center; padding:14px; border-radius:8px; font-weight:700; font-size:14px; text-decoration:none; margin:20px 0; letter-spacing:.04em; }
    ul { margin:0; padding:0; list-style:none; }
    ul li { font-size:13px; color:#475569; line-height:1.6; padding:6px 0 6px 20px; position:relative; border-bottom:.5px solid #f1f5f9; }
    ul li:last-child { border-bottom:none; }
    ul li:before { content:''; position:absolute; left:0; top:13px; width:6px; height:6px; border-radius:50%; background:#d4a832; }
    ol { margin:0; padding:0; list-style:none; counter-reset:mod; }
    ol li { counter-increment:mod; font-size:13px; color:#475569; padding:7px 0 7px 34px; position:relative; border-bottom:.5px solid #f1f5f9; }
    ol li:last-child { border-bottom:none; }
    ol li:before { content:counter(mod); position:absolute; left:0; top:6px; width:22px; height:22px; background:#0a1628; color:#d4a832; border-radius:50%; font-size:11px; font-weight:700; text-align:center; line-height:22px; }
    .pay-box { background:#0a1628; border-radius:10px; padding:20px 22px; margin:16px 0; }
    .pay-box p { color:#cbd5e1; margin-bottom:8px; }
    .pay-box a { color:#d4a832; }
    .pay-box .warn { color:#fca5a5; font-size:12px; margin-top:10px; margin-bottom:0; }
    .sig { margin-top:20px; padding-top:16px; border-top:1px solid #e2e8f0; }
    .sig p { font-size:13px; color:#475569; margin:0; line-height:1.8; }
    .ef { background:#0a1628; padding:20px 40px; text-align:center; }
    .ef p { color:#64748b; font-size:12px; margin:0; line-height:1.8; }
    .ef a { color:#d4a832; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="eh">
      <div class="logo">Mind Over Markets</div>
      <h1>Welcome to the<br><em>Group Mentorship!</em></h1>
      <div class="eh-sub">${startDate} – ${endDate} &nbsp;·&nbsp; 7 Weeks</div>
    </div>
    <div class="eb">
      <div class="greet">Hi ${firstName},</div>
      <p>Welcome to the <strong>Mind Over Markets Group Mentorship Program!</strong> Great news — our next batch (<strong>${batchName}</strong>) officially starts on <strong>${startDate}</strong> and runs until <strong>${endDate}</strong>. This is a structured 7-week program built for traders who want discipline, clarity, confidence, and a deeper understanding of the markets.</p>
      <div class="highlight"><p>Your seat is being held. Please complete your payment before <strong>${paymentDeadline}</strong> to confirm your spot. Limited to 10 seats.</p></div>

      <div class="sec">Program Overview</div>
      <div class="grid">
        <div class="cell"><div class="cell-label">Duration</div><div class="cell-val">7 Weeks</div></div>
        <div class="cell"><div class="cell-label">Schedule</div><div class="cell-val">Every ${sessionDay}</div></div>
        <div class="cell"><div class="cell-label">Time</div><div class="cell-val">${sessionTime}</div></div>
        <div class="cell"><div class="cell-label">Fee</div><div class="cell-val">${fee}</div></div>
        <div class="cell" style="grid-column:1/-1"><div class="cell-label">Format</div><div class="cell-val">Live Zoom Sessions + Private Discord Community</div></div>
      </div>

      <a class="zoom-btn" href="${zoomLink}">Join Zoom Session &rarr;</a>

      <div class="sec">What's Included</div>
      <ul>
        <li>7 weeks of structured mentorship with live guidance and community interaction</li>
        <li>Balanced mix of live classes, recaps, and review sessions</li>
        <li>Foundational Market Knowledge – understanding how markets operate and price movement</li>
        <li>Introduction to Futures Trading – mechanics, key concepts, and professional setup</li>
        <li>Trade Execution Process – discipline before, during, and after each trade</li>
        <li>My Unique Strategy & Edge – Smart Money Concepts (SMC) adapted to your style</li>
        <li>Private Discord community for chart sharing, trade discussions, and Q&A</li>
        <li>Daily trade journal access to track and refine your performance</li>
        <li>Post-mentorship Q&A support to continue your growth after the program</li>
      </ul>

      <div class="sec">Mentorship Modules</div>
      <ol>
        <li>The Truth About Trading & Mastering the Trading Mindset</li>
        <li>Understanding Charts, Candlesticks & Market Structure</li>
        <li>Futures Market Fundamentals & Introduction to Liquidity Concepts</li>
        <li>Smart Money Concepts – Order Blocks & Fair Value Gaps (FVG)</li>
        <li>Strategy Deep Dive – FVG Trading Strategy</li>
        <li>Strategy Deep Dive – Inverse FVG (iFVG) Strategy</li>
        <li>Risk Management, Position Sizing, Prop Firm Strategies & Trading Psychology</li>
      </ol>

      <div class="sec">Session Format</div>
      <p>Each session includes approximately <strong>1 hour 30 minutes</strong> of teaching, followed by a <strong>20–30 minute Q&A</strong>. All sessions are recorded and shared exclusively with enrolled students.</p>

      <div class="sec">How to Prepare</div>
      <ul>
        <li>Join from a quiet place with a stable internet connection</li>
        <li>Bring a notebook and pen for taking notes</li>
        <li>Join 5 minutes early so we can start on time</li>
      </ul>

      <div class="sec">Payment</div>
      <div class="pay-box">
        <p><strong style="color:#d4a832;">Canada</strong> — Interac e-Transfer to <a href="mailto:${FROM_EMAIL}">${FROM_EMAIL}</a></p>
        <p><strong style="color:#d4a832;">Outside Canada</strong> — <a href="https://wise.com/pay/me/anishm11">wise.com/pay/me/anishm11</a></p>
        <p class="warn">⚠ Payment due by ${paymentDeadline}. Include your full name in the transfer. Non-refundable.</p>
      </div>

      <div class="sig">
        <p>If you have any questions, simply reply to this email and I'll personally guide you through the next steps.</p>
        <p>Let's make these 7 weeks a powerful turning point in your trading journey.</p>
        <p style="margin-top:12px"><strong>Warm regards,<br>Anish Kumar Pillai</strong><br>Mind Over Markets</p>
      </div>
    </div>
    <div class="ef">
      <p>Mind Over Markets &nbsp;·&nbsp; <a href="mailto:${FROM_EMAIL}">${FROM_EMAIL}</a> &nbsp;·&nbsp; +1 (613) 701-4597</p>
    </div>
  </div>
</body>
</html>`
}

function oneOnOneEmailHtml(vars: { firstName: string; fee: string }) {
  const { firstName, fee } = vars
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:Arial,sans-serif; }
    .wrap { max-width:580px; margin:40px auto; background:#fff; border-radius:14px; overflow:hidden; border:1px solid #e2e8f0; }
    .eh { background:#0a1628; padding:36px 40px; text-align:center; }
    .logo { color:#d4a832; font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; margin-bottom:10px; }
    .eh h1 { color:#fff; font-size:26px; font-weight:700; margin:0; line-height:1.35; }
    .eh h1 em { color:#d4a832; font-style:normal; }
    .eh-sub { color:#94a3b8; font-size:13px; margin-top:10px; }
    .eb { padding:32px 40px; }
    .greet { font-size:17px; font-weight:700; color:#0a1628; margin-bottom:14px; }
    p { color:#475569; font-size:14px; line-height:1.75; margin-bottom:14px; }
    .highlight { background:#fdf8ec; border-left:3px solid #d4a832; border-radius:0 8px 8px 0; padding:14px 18px; margin:20px 0; }
    .highlight p { color:#78540a; margin:0; font-weight:500; }
    .sec { font-size:12px; font-weight:700; color:#0a1628; letter-spacing:.08em; text-transform:uppercase; margin:24px 0 10px; border-bottom:1px solid #e2e8f0; padding-bottom:7px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:14px 0; }
    .cell { background:#f8fafc; border-radius:8px; padding:12px 14px; border:.5px solid #e2e8f0; }
    .cell-label { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
    .cell-val { font-size:13px; font-weight:600; color:#0a1628; }
    ul { margin:0; padding:0; list-style:none; }
    ul li { font-size:13px; color:#475569; line-height:1.6; padding:6px 0 6px 20px; position:relative; border-bottom:.5px solid #f1f5f9; }
    ul li:last-child { border-bottom:none; }
    ul li:before { content:''; position:absolute; left:0; top:13px; width:6px; height:6px; border-radius:50%; background:#d4a832; }
    ol { margin:0; padding:0; list-style:none; counter-reset:mod; }
    ol li { counter-increment:mod; font-size:13px; color:#475569; padding:7px 0 7px 34px; position:relative; border-bottom:.5px solid #f1f5f9; }
    ol li:last-child { border-bottom:none; }
    ol li:before { content:counter(mod); position:absolute; left:0; top:6px; width:22px; height:22px; background:#0a1628; color:#d4a832; border-radius:50%; font-size:11px; font-weight:700; text-align:center; line-height:22px; }
    .sig { margin-top:20px; padding-top:16px; border-top:1px solid #e2e8f0; }
    .sig p { font-size:13px; color:#475569; margin:0; line-height:1.8; }
    .ef { background:#0a1628; padding:20px 40px; text-align:center; }
    .ef p { color:#64748b; font-size:12px; margin:0; line-height:1.8; }
    .ef a { color:#d4a832; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="eh">
      <div class="logo">Mind Over Markets</div>
      <h1>Welcome to Your<br><em>1-on-1 Mentorship!</em></h1>
      <div class="eh-sub">Personalized · 7 Weeks · Built Around You</div>
    </div>
    <div class="eb">
      <div class="greet">Hi ${firstName},</div>
      <p>Welcome to the <strong>Mind Over Markets 1-on-1 Mentorship Program!</strong> I'm genuinely excited to work with you personally over the next 7 weeks. This program is fully tailored around your goals, your questions, and your specific challenges as a trader.</p>
      <div class="highlight"><p>Your spot is confirmed. I'll reach out personally within 24 hours to schedule our first session and get you set up.</p></div>

      <div class="sec">Program Overview</div>
      <div class="grid">
        <div class="cell"><div class="cell-label">Duration</div><div class="cell-val">7 Weeks</div></div>
        <div class="cell"><div class="cell-label">Sessions</div><div class="cell-val">1–2 per Week</div></div>
        <div class="cell"><div class="cell-label">Fee</div><div class="cell-val">${fee}</div></div>
        <div class="cell"><div class="cell-label">Format</div><div class="cell-val">Live Zoom + Discord</div></div>
      </div>

      <div class="sec">What's Included</div>
      <ul>
        <li>7 weeks of personalized mentorship built around your specific needs</li>
        <li>Foundational Market Knowledge – how markets operate and what drives price movement</li>
        <li>Introduction to Futures – trading mechanics, key concepts, and professional setup</li>
        <li>Trade Execution Process – step-by-step discipline before, during, and after each trade</li>
        <li>My Unique Strategy & Edge – Smart Money Concepts (SMC) adapted directly to your style</li>
        <li>Private Discord group for trade ideas, chart sharing, and direct Q&A with me</li>
        <li>Feedback and discussion on your charts between sessions</li>
        <li>Daily trade journal access to track and refine your performance</li>
        <li>Post-mentorship Q&A support to continue your growth after the program</li>
      </ul>

      <div class="sec">Mentorship Modules</div>
      <ol>
        <li>Understanding Charts, Candlesticks & Market Structure</li>
        <li>Futures Market Fundamentals & Introduction to Liquidity Concepts</li>
        <li>Smart Money Concepts – Order Blocks & Fair Value Gaps (FVG)</li>
        <li>Strategy Deep Dive – FVG Trading Strategy</li>
        <li>Strategy Deep Dive – Inverse FVG (iFVG) Strategy</li>
        <li>Risk Management, Position Sizing, Prop Firm Strategies & Trading Psychology</li>
      </ol>

      <div class="sec">Community & Ongoing Support</div>
      <ul>
        <li>Access to a private Discord group for trade ideas, chart sharing, and Q&A</li>
        <li>Feedback and discussion on your charts between sessions</li>
        <li>Post-mentorship support to continue your growth after the program ends</li>
      </ul>

      <div class="sig">
        <p>I look forward to helping you strengthen your technical and psychological edge in trading.</p>
        <p>Let's make these 7 weeks a powerful turning point in your trading journey.</p>
        <p style="margin-top:12px"><strong>Warm regards,<br>Anish Kumar Pillai</strong><br>Mind Over Markets</p>
      </div>
    </div>
    <div class="ef">
      <p>Mind Over Markets &nbsp;·&nbsp; <a href="mailto:${FROM_EMAIL}">${FROM_EMAIL}</a> &nbsp;·&nbsp; +1 647-687-3758</p>
    </div>
  </div>
</body>
</html>`
}

// ── Commands ──────────────────────────────────────────────────────────────

// send <batch_key> <email>
async function handleSend(chatId: number, args: string) {
  const parts     = args.trim().split(' ')
  const batchKey  = parts[0]?.toLowerCase()
  const email     = parts[1]?.toLowerCase()

  if (!batchKey || !email) {
    return sendTelegram(chatId, '❌ Usage: `send <batch_key> user@email.com`\nExample: `send june10 john@gmail.com`')
  }

  // Fetch batch template
  const { data: batches, error: batchErr } = await supabase
    .from('email_batches')
    .select('*')
    .eq('batch_key', batchKey)
    .limit(1)

  if (batchErr) return sendTelegram(chatId, `❌ Database error: ${batchErr.message}`)
  if (!batches || batches.length === 0) {
    return sendTelegram(chatId, `❌ No batch found with key: \`${batchKey}\`\nCreate it in the CRM dashboard first.`)
  }

  const batch = batches[0]

  // Fetch lead
  const { data: leads, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .ilike('email', email)
    .limit(1)

  if (leadErr) return sendTelegram(chatId, `❌ Database error: ${leadErr.message}`)
  if (!leads || leads.length === 0) {
    return sendTelegram(chatId, `❌ No lead found with email: \`${email}\``)
  }

  const lead      = leads[0]
  const firstName = (lead.full_name || lead.name || 'there').split(' ')[0]

  await sendTelegram(chatId, `⏳ Sending *${batch.batch_name}* email to *${firstName}*...`)

  try {
    let html: string
    let subject: string

    if (batch.type === 'group') {
      subject = `Welcome to ${batch.batch_name} — MOM Mentorship 🎉`
      html = groupEmailHtml({
        firstName,
        batchName:       batch.batch_name,
        startDate:       formatDate(batch.start_date),
        endDate:         formatDate(batch.end_date),
        fee:             batch.fee,
        paymentDeadline: batch.payment_deadline ? formatDate(batch.payment_deadline) : 'TBD',
        zoomLink:        batch.zoom_link || '#',
        sessionDay:      batch.session_day || 'Wednesday',
        sessionTime:     batch.session_time || '7:00 PM – 9:00 PM ET',
      })
    } else {
      subject = `Welcome to MOM 1-on-1 Mentorship, ${firstName}! 🎉`
      html = oneOnOneEmailHtml({ firstName, fee: batch.fee })
    }

    await sendEmail(email, subject, html)

    // Update lead status
    await supabase
      .from('leads')
      .update({ status: 'contacted', last_contacted_at: new Date().toISOString() })
      .eq('id', lead.id)

    await sendTelegram(chatId,
      `✅ *${batch.batch_name}* email sent!\n` +
      `👤 *${firstName}*\n📧 ${email}\n` +
      `📋 Type: ${batch.type === 'group' ? 'Group' : '1-on-1'}\n` +
      `🔄 Status → *Contacted*`)
  } catch (err: any) {
    await sendTelegram(chatId, `❌ Email failed: ${err.message}`)
  }
}

// list available batch keys
async function handleBatches(chatId: number) {
  const { data: batches } = await supabase
    .from('email_batches')
    .select('batch_key, batch_name, type, start_date')
    .order('created_at', { ascending: false })

  if (!batches || batches.length === 0) {
    return sendTelegram(chatId, '📭 No batch templates yet. Create one in the CRM dashboard.')
  }

  let msg = `📦 *Available Batches (${batches.length})*\n\n`
  batches.forEach(b => {
    const typeLabel = b.type === 'group' ? '👥 Group' : '🎯 1-on-1'
    msg += `• \`${b.batch_key}\` — ${b.batch_name}\n  ${typeLabel} · Starts ${formatDate(b.start_date)}\n\n`
  })
  msg += `_Use: \`send <key> email@x.com\`_`
  await sendTelegram(chatId, msg)
}

async function handleWelcome(chatId: number, args: string) {
  const email = args.trim().toLowerCase()
  if (!email) return sendTelegram(chatId, '❌ Usage: `welcome user@email.com`')

  const { data: leads, error } = await supabase
    .from('leads').select('*').ilike('email', email).limit(1)

  if (error) return sendTelegram(chatId, `❌ Database error: ${error.message}`)
  if (!leads || leads.length === 0) return sendTelegram(chatId, `❌ No lead found: \`${email}\``)

  const lead    = leads[0]
  const name    = lead.full_name || lead.name || 'there'
  const program = lead.program || 'MOM Mentorship'

  await sendTelegram(chatId, `⏳ Sending generic welcome to *${name}*...`)

  try {
    const subject = `Welcome to MOM Mentorship, ${name.split(' ')[0]}! 🎉`
    const html    = oneOnOneEmailHtml({ firstName: name.split(' ')[0], fee: program })
    await sendEmail(email, subject, html)
    await supabase.from('leads')
      .update({ status: 'contacted', last_contacted_at: new Date().toISOString() })
      .eq('id', lead.id)
    await sendTelegram(chatId, `✅ Welcome email sent to *${name}*!\n📧 ${email}\n🔄 Status → *Contacted*`)
  } catch (err: any) {
    await sendTelegram(chatId, `❌ Email failed: ${err.message}`)
  }
}

async function handleLeads(chatId: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { data: leads } = await supabase
    .from('leads').select('full_name, name, email, status, created_at')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  if (!leads || leads.length === 0) return sendTelegram(chatId, '📭 No new leads today.')

  let msg = `📋 *Today\'s Leads (${leads.length})*\n\n`
  leads.forEach((l, i) => {
    msg += `${i + 1}. *${l.full_name || l.name || 'Unknown'}*\n   📧 ${l.email}\n   🔵 ${l.status}\n\n`
  })
  await sendTelegram(chatId, msg)
}

async function handleAll(chatId: number, statusFilter?: string) {
  let query = supabase.from('leads')
    .select('full_name, name, email, status, created_at')
    .order('created_at', { ascending: false }).limit(10)
  if (statusFilter) query = query.eq('status', statusFilter)
  const { data: leads } = await query
  if (!leads || leads.length === 0)
    return sendTelegram(chatId, `📭 No leads${statusFilter ? ` with status: ${statusFilter}` : ''}.`)

  let msg = `📋 *Leads${statusFilter ? ` — ${statusFilter}` : ' (latest 10)'}*\n\n`
  leads.forEach((l, i) => {
    msg += `${i + 1}. *${l.full_name || l.name || 'Unknown'}*\n   📧 ${l.email}\n   🔵 ${l.status}\n\n`
  })
  await sendTelegram(chatId, msg)
}

async function handleStatus(chatId: number, args: string) {
  const parts  = args.trim().split(' ')
  const email  = parts[0]?.toLowerCase()
  const status = parts[1]?.toLowerCase()
  const valid  = ['new', 'contacted', 'interested', 'enrolled', 'declined']
  if (!email || !status) return sendTelegram(chatId, '❌ Usage: `status email@x.com enrolled`')
  if (!valid.includes(status)) return sendTelegram(chatId, `❌ Valid statuses: ${valid.join(', ')}`)
  const { data, error } = await supabase.from('leads').update({ status }).ilike('email', email).select()
  if (error || !data?.length) return sendTelegram(chatId, `❌ Lead not found: ${email}`)
  await sendTelegram(chatId, `✅ *${data[0].full_name || data[0].name || email}* → *${status}*`)
}

async function handleHelp(chatId: number) {
  await sendTelegram(chatId,
    `🛡 *MOM CRM Bot*\n\n` +
    `📧 Send batch email:\n\`send june10 user@email.com\`\n\n` +
    `📦 List all batches:\n\`batches\`\n\n` +
    `📋 Today\'s leads:\n\`leads\`\n\n` +
    `📊 Latest 10 leads:\n\`all\`\n\n` +
    `🔍 Filter by status:\n\`all new\` | \`all enrolled\`\n\n` +
    `🔄 Update status:\n\`status user@email.com enrolled\`\n\n` +
    `📬 Generic welcome email:\n\`welcome user@email.com\`\n\n` +
    `Valid statuses: new, contacted, interested, enrolled, declined`)
}

// ── Main ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body    = await req.json()
    const message = body?.message
    if (!message?.text) return NextResponse.json({ ok: true })

    const chatId  = message.chat.id
    const userId  = message.from.id
    const text    = message.text.trim()

    if (userId !== ALLOWED_USER_ID) {
      await sendTelegram(chatId, '🚫 Unauthorized.')
      return NextResponse.json({ ok: true })
    }

    const parts   = text.split(' ')
    const command = parts[0].toLowerCase().replace('/', '')
    const args    = parts.slice(1).join(' ')

    switch (command) {
      case 'send':    await handleSend(chatId, args);             break
      case 'batches': await handleBatches(chatId);                break
      case 'welcome': await handleWelcome(chatId, args);          break
      case 'leads':
      case 'today':   await handleLeads(chatId);                  break
      case 'all':     await handleAll(chatId, args || undefined);  break
      case 'status':  await handleStatus(chatId, args);           break
      case 'help':
      case 'start':   await handleHelp(chatId);                   break
      default:
        await sendTelegram(chatId, `❓ Unknown command. Send \`help\` to see all commands.`)
    }
  } catch (err: any) {
    console.error('Bot error:', err)
  }
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, status: 'MOM CRM Bot is running' })
}
