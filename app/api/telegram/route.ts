// Telegram Bot + Resend Email Integration
// Deploy this as a Vercel serverless function at /api/telegram
// Set up webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.vercel.app/api/telegram

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

// ── Email templates ────────────────────────────────────────────────────────
function welcomeEmailHtml(name: string, program: string) {
  const firstName = name.split(' ')[0]
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: 'DM Sans', Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #0a0f1e 0%, #0d1a0d 100%); padding: 40px 40px 32px; text-align: center; }
    .logo { color: #22c55e; font-size: 13px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px; }
    .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.3; }
    .header h1 em { color: #22c55e; font-style: normal; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    p { color: #475569; line-height: 1.7; margin-bottom: 16px; font-size: 15px; }
    .highlight-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
    .highlight-box p { color: #166534; margin: 0; font-weight: 500; }
    .highlight-box strong { color: #15803d; }
    .cta-btn { display: inline-block; background: #22c55e; color: #021a09; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none; margin: 8px 0 24px; }
    .steps { margin: 24px 0; }
    .step { display: flex; gap: 16px; margin-bottom: 16px; align-items: flex-start; }
    .step-num { width: 28px; height: 28px; background: #22c55e; color: #021a09; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; margin-top: 2px; }
    .step-text { color: #374151; font-size: 14px; line-height: 1.6; }
    .step-text strong { color: #0f172a; }
    .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.6; }
    .footer a { color: #22c55e; text-decoration: none; }
    @media (max-width: 600px) {
      .body { padding: 24px 20px; }
      .header { padding: 28px 20px; }
      .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">Mind Over Markets</div>
      <h1>Welcome to the<br/><em>MOM Family!</em> 🎉</h1>
    </div>
    <div class="body">
      <p class="greeting">Hey ${firstName},</p>
      <p>I am thrilled to have you on board! Your spot in the <strong>${program || 'MOM Mentorship'}</strong> program has been confirmed and I am genuinely excited to work with you.</p>

      <div class="highlight-box">
        <p>✅ <strong>Your enrollment is confirmed.</strong> Here is what happens next — I will reach out personally within the next 24 hours to get you set up and ready to go.</p>
      </div>

      <p>Here is what to expect over the coming days:</p>

      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text"><strong>Welcome call</strong> — We will hop on a quick call to go over your goals, current challenges, and what you want to achieve.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Access to resources</strong> — You will get access to all course materials, trading frameworks, and community channels.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text"><strong>First session</strong> — We dive straight into building your trading plan and addressing your specific challenges.</div>
        </div>
      </div>

      <p>If you have any questions before we connect, feel free to reply to this email directly. I read every message personally.</p>

      <p>Talk soon,<br/><strong>Anish</strong><br/>Mind Over Markets</p>
    </div>
    <div class="footer">
      <p>
        Mind Over Markets Mentorship<br/>
        <a href="mailto:anish@mindovermarkets.net">anish@mindovermarkets.net</a>
      </p>
    </div>
  </div>
</body>
</html>
  `
}

// ── Telegram helpers ───────────────────────────────────────────────────────
async function sendTelegram(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  })
}

// ── Send email via Resend ──────────────────────────────────────────────────
async function sendEmail(to: string, name: string, program: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    `${FROM_NAME} <${FROM_EMAIL}>`,
      to:      [to],
      subject: `Welcome to MOM Mentorship, ${name.split(' ')[0]}! 🎉`,
      html:    welcomeEmailHtml(name, program),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Email send failed')
  return data
}

// ── Command handlers ───────────────────────────────────────────────────────
async function handleWelcome(chatId: number, args: string) {
  const email = args.trim().toLowerCase()
  if (!email) {
    return sendTelegram(chatId, '❌ Usage: `welcome user@email.com`')
  }

  // Find lead in Supabase
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .ilike('email', email)
    .limit(1)

  if (error || !leads || leads.length === 0) {
    return sendTelegram(chatId, `❌ No lead found with email: \`${email}\``)
  }

  const lead = leads[0]
  const name = lead.full_name || lead.name || 'there'
  const program = lead.program || 'MOM Mentorship'

  await sendTelegram(chatId, `⏳ Sending welcome email to *${name}* (${email})...`)

  try {
    await sendEmail(email, name, program)

    // Update lead status to contacted
    await supabase
      .from('leads')
      .update({ status: 'contacted', last_contacted_at: new Date().toISOString() })
      .eq('id', lead.id)

    await sendTelegram(chatId,
      `✅ Welcome email sent to *${name}*!\n\n` +
      `📧 ${email}\n` +
      `📋 Program: ${program}\n` +
      `🔄 Status updated to: *Contacted*`
    )
  } catch (err: any) {
    await sendTelegram(chatId, `❌ Failed to send email: ${err.message}`)
  }
}

async function handleLeads(chatId: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: leads } = await supabase
    .from('leads')
    .select('full_name, name, email, market, program, status, created_at')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  if (!leads || leads.length === 0) {
    return sendTelegram(chatId, '📭 No new leads today.')
  }

  let msg = `📋 *Today\'s Leads (${leads.length})*\n\n`
  leads.forEach((l, i) => {
    const name = l.full_name || l.name || 'Unknown'
    msg += `${i + 1}. *${name}*\n`
    msg += `   📧 ${l.email}\n`
    msg += `   📊 ${l.market || '—'} | ${l.program || '—'}\n`
    msg += `   🔵 ${l.status}\n\n`
  })

  await sendTelegram(chatId, msg)
}

async function handleStatus(chatId: number, args: string) {
  const parts = args.trim().split(' ')
  if (parts.length < 2) {
    return sendTelegram(chatId,
      '❌ Usage: `status user@email.com new|contacted|interested|enrolled|declined`')
  }

  const email  = parts[0].toLowerCase()
  const status = parts[1].toLowerCase()
  const validStatuses = ['new', 'contacted', 'interested', 'enrolled', 'declined']

  if (!validStatuses.includes(status)) {
    return sendTelegram(chatId,
      `❌ Invalid status. Use: ${validStatuses.join(', ')}`)
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .ilike('email', email)
    .select()

  if (error || !data || data.length === 0) {
    return sendTelegram(chatId, `❌ No lead found: \`${email}\``)
  }

  const name = data[0].full_name || data[0].name || email
  await sendTelegram(chatId,
    `✅ *${name}* status updated to *${status}*`)
}

async function handleAllLeads(chatId: number, statusFilter?: string) {
  let query = supabase
    .from('leads')
    .select('full_name, name, email, market, program, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data: leads } = await query

  if (!leads || leads.length === 0) {
    return sendTelegram(chatId, `📭 No leads found${statusFilter ? ` with status: ${statusFilter}` : ''}.`)
  }

  let msg = `📋 *Leads${statusFilter ? ` — ${statusFilter}` : ' (latest 10)'}*\n\n`
  leads.forEach((l, i) => {
    const name = l.full_name || l.name || 'Unknown'
    msg += `${i + 1}. *${name}*\n`
    msg += `   📧 ${l.email}\n`
    msg += `   🔵 ${l.status}\n\n`
  })

  await sendTelegram(chatId, msg)
}

async function handleHelp(chatId: number) {
  await sendTelegram(chatId,
    `🛡 *MOM CRM Bot Commands*\n\n` +
    `📧 *Send welcome email:*\n\`welcome user@email.com\`\n\n` +
    `📋 *Today\'s new leads:*\n\`leads\`\n\n` +
    `📊 *All leads (latest 10):*\n\`all\`\n\n` +
    `🔍 *Filter by status:*\n\`all new\`\n\`all interested\`\n\`all enrolled\`\n\n` +
    `🔄 *Update lead status:*\n\`status user@email.com enrolled\`\n\n` +
    `Valid statuses: new, contacted, interested, enrolled, declined`
  )
}

// ── Main handler ───────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true })
  }

  try {
    const { message } = req.body
    if (!message || !message.text) {
      return res.status(200).json({ ok: true })
    }

    const chatId = message.chat.id
    const userId = message.from.id
    const text   = message.text.trim()

    // Security — only respond to your Telegram ID
    if (userId !== ALLOWED_USER_ID) {
      await sendTelegram(chatId, '🚫 Unauthorized.')
      return res.status(200).json({ ok: true })
    }

    // Parse command
    const parts   = text.split(' ')
    const command = parts[0].toLowerCase().replace('/', '')
    const args    = parts.slice(1).join(' ')

    switch (command) {
      case 'welcome':
        await handleWelcome(chatId, args)
        break
      case 'leads':
      case 'today':
        await handleLeads(chatId)
        break
      case 'all':
        await handleAllLeads(chatId, args || undefined)
        break
      case 'status':
        await handleStatus(chatId, args)
        break
      case 'help':
      case 'start':
        await handleHelp(chatId)
        break
      default:
        await sendTelegram(chatId,
          `❓ Unknown command. Send \`help\` to see all commands.`)
    }

  } catch (err: any) {
    console.error('Bot error:', err)
  }

  return res.status(200).json({ ok: true })
}
