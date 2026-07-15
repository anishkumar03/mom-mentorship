// supabase/functions/zoom-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb          = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET      = Deno.env.get("ZOOM_WEBHOOK_SECRET_TOKEN")!;
const BOT_TOKEN   = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID     = Deno.env.get("TELEGRAM_CHAT_ID")!;
const DELAY_MIN   = parseInt(Deno.env.get("DISPATCH_DELAY_MINUTES") ?? "60");

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function sendTelegram(text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });
}

async function verifyZoom(req: Request, body: string): Promise<boolean> {
  const ts  = req.headers.get("x-zm-request-timestamp") ?? "";
  const sig = req.headers.get("x-zm-signature") ?? "";
  return `v0=${await hmac(SECRET, `v0:${ts}:${body}`)}` === sig;
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  const rawBody = await req.text();
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return new Response("Bad JSON", { status: 400 }); }

  // URL validation
  if (payload.event === "endpoint.url_validation") {
    const hash = await hmac(SECRET, payload.payload?.plainToken ?? "");
    return new Response(JSON.stringify({ plainToken: payload.payload.plainToken, encryptedToken: hash }), { headers: { "Content-Type": "application/json" } });
  }

  if (!(await verifyZoom(req, rawBody))) return new Response("Unauthorized", { status: 401 });
  if (payload.event !== "meeting.ended") return new Response("Ignored", { status: 200 });

  const meeting     = payload.payload?.object ?? {};
  const title       = (meeting.topic ?? "Session").trim();
  const meetingId   = String(meeting.id ?? "");
  const endTime     = new Date(meeting.end_time ?? Date.now());
  const startTime   = new Date(meeting.start_time ?? Date.now());
  const meetingDate = startTime.toISOString().split("T")[0];
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  console.log(`meeting.ended: "${title}" | id=${meetingId} | duration=${durationMin}min`);

  // Check if group batch
  const { data: batches } = await sb.from("batch_groups").select("batch_name,zoom_title_match").eq("active", true);
  let sessionType: string | null = null;
  let batchName: string | null = null;
  if (batches) {
    for (const b of batches) {
      const kw = (b.zoom_title_match ?? "").trim();
      if (kw && title.toLowerCase().includes(kw.toLowerCase())) {
        sessionType = "group"; batchName = b.batch_name; break;
      }
    }
  }

  // "No batch matched" is ALSO the expected, correct signal for a genuine one-on-one meeting —
  // that's the entire reason a default used to exist here. But defaulting straight to
  // one_on_one whenever nothing matched had no way to distinguish "this really is a 1-on-1"
  // from "this is a group meeting whose title just doesn't have the right keyword in it yet" —
  // and that ambiguity is exactly what produced both incidents (July 13's silent no-send and
  // July 14's group email going to a 1-on-1 student), since a wrongly-typed one_on_one dispatch
  // then went on to search session_invitees and pick whichever real 1-on-1 happened to be
  // nearby in time. So instead of defaulting, only accept one-on-one when there's an actual
  // positive signal for it: Zoom's own one-on-one meetings are titled "<Student> and Anish ..."
  // (the same convention their recording folders inherit). Anything matching neither pattern is
  // genuinely ambiguous and must not be guessed either way.
  if (!sessionType && / and /i.test(title)) {
    sessionType = "one_on_one";
  }
  const isAmbiguous = !sessionType;

  const scheduledAt = new Date(endTime.getTime() + DELAY_MIN * 60_000);
  const studentName = title.split(" and ")[0].trim();

  // Insert with status "waiting_topic" — waits for Telegram reply. Ambiguous meetings still get
  // a row (so /status shows them and nothing is lost) but with session_type left null:
  // dispatch-processor already refuses to guess an unknown session_type, so this can never
  // silently misroute — it just won't fire until session_type/batch_name are fixed by hand.
  const { data: inserted, error } = await sb.from("pending_dispatches").insert({
    session_name:       title,
    zoom_meeting_id:    meetingId,
    session_type:       sessionType,
    batch_name:         batchName,
    meeting_start_time: startTime.toISOString(),
    meeting_date:       meetingDate,
    scheduled_at:       scheduledAt.toISOString(),
    status:             "waiting_topic",
    notes_topic:        null,
  }).select().single();

  if (error) {
    console.error("DB error:", error);
    await sendTelegram(`🚨 <b>zoom-webhook: failed to queue dispatch</b>\n📛 "${title}"\n❌ ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (isAmbiguous) {
    await sendTelegram(
      `❓ <b>Meeting ended but couldn't be classified</b>\n\n` +
      `📛 "${title}"\n📅 ${meetingDate} · ${durationMin} min\n\n` +
      `This title doesn't match any active batch's Zoom keyword, and doesn't look like a ` +
      `one-on-one ("&lt;Student&gt; and Anish") either. It's queued, but <b>no email will send</b> ` +
      `until this is fixed — either rename the Zoom meeting/update the batch's zoom_title_match, ` +
      `or fix this dispatch's session_type/batch_name directly in the database. Check /status.`
    );
  } else {
    await sendTelegram(
      `📚 <b>Session ended!</b>\n\n` +
      `👤 Student: <b>${studentName}</b>\n` +
      `⏱ Duration: ${durationMin} min\n` +
      `📅 Date: ${meetingDate}\n\n` +
      `<b>Reply with today's topic</b> (e.g. "Fair Value Gap" or "Market Structure")\n\n` +
      `⏰ Email will send in ${DELAY_MIN} min — reply before then!`
    );
  }

  console.log(`Queued [${sessionType ?? "AMBIGUOUS"}] "${title}" → fires at ${scheduledAt.toISOString()}`);
  return new Response(JSON.stringify({ queued: true, sessionType, batchName, ambiguous: isAmbiguous, scheduledAt }), { status: 200 });
});
