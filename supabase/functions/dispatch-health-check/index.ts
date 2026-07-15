// supabase/functions/dispatch-health-check/index.ts
//
// Runs the two checks dispatch-processor itself has no way to make: (1) a Zoom recording
// synced to Drive that doesn't match ANY active batch's zoom_title_match — this is exactly
// what happened on July 13, where the session simply had no matching batch and produced no
// email and no trace; (2) a batch that's gone quiet — no successful dispatch in over a week.
//
// Meant to be invoked on a schedule (Supabase dashboard: Edge Functions -> dispatch-health-check
// -> Cron Triggers, e.g. once or twice a day). Can also be called manually, optionally with
// ?dry_run=true to preview what it would alert on without sending Telegram or writing to the
// alert-dedup table.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SA        = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID   = Deno.env.get("TELEGRAM_CHAT_ID")!;

const RECORDING_LOOKBACK_DAYS  = Number(Deno.env.get("HEALTH_CHECK_LOOKBACK_DAYS") ?? "2");
const STALE_BATCH_DAYS         = Number(Deno.env.get("STALE_BATCH_DAYS") ?? "7");
const WAITING_TOPIC_STALE_HOURS = Number(Deno.env.get("WAITING_TOPIC_STALE_HOURS") ?? "3");

async function sendTelegram(text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch (e: any) {
    console.error("Telegram notify failed:", e.message);
  }
}

// Same JWT flow as dispatch-processor's gToken() — duplicated rather than shared since these
// are independently deployed Edge Functions with no shared module in this project.
async function gToken(): Promise<string> {
  const sa  = JSON.parse(SA);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const si  = `${b64({alg:"RS256",typ:"JWT"})}.${b64({iss:sa.client_email,scope:"https://www.googleapis.com/auth/drive.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})}`;
  const pb  = sa.private_key.replace(/\\n/g,"\n").replace(/-----[^-]+-----/g,"").replace(/\s/g,"");
  const kb  = Uint8Array.from(atob(pb), c => c.charCodeAt(0));
  const ck  = await crypto.subtle.importKey("pkcs8", kb.buffer, {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"}, false, ["sign"]);
  const sb2 = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", ck, new TextEncoder().encode(si));
  const sg  = btoa(String.fromCharCode(...new Uint8Array(sb2))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const r   = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${si}.${sg}` });
  const d   = await r.json();
  if (!d.access_token) throw new Error("Google auth: " + JSON.stringify(d));
  return d.access_token;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function alreadyAlerted(key: string): Promise<boolean> {
  const { data } = await sb.from("dispatch_health_alerts").select("alert_key").eq("alert_key", key).maybeSingle();
  return !!data;
}

async function recordAlert(key: string): Promise<void> {
  await sb.from("dispatch_health_alerts").upsert({ alert_key: key, alerted_at: new Date().toISOString() });
}

// ── Check 1: recordings that matched no active batch ──────────────────────────
async function checkUnmatchedRecordings(tok: string, dryRun: boolean): Promise<{ checked: string[]; unmatched: string[]; alerted: string[] }> {
  const { data: batches } = await sb.from("batch_groups").select("batch_name,zoom_title_match").eq("active", true);
  const keywords = (batches ?? []).map(b => (b.zoom_title_match ?? "").trim()).filter(Boolean);

  const checked: string[] = [];
  const unmatched: string[] = [];
  const alerted: string[] = [];

  for (let i = 0; i < RECORDING_LOOKBACK_DAYS; i++) {
    const date = isoDate(new Date(Date.now() - i * 86400000));
    const folderQuery = `mimeType='application/vnd.google-apps.folder' and name contains '${date}' and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)&pageSize=20`, { headers: { Authorization: `Bearer ${tok}` } });
    const rawFolders: any[] = (await res.json()).files ?? [];
    // Same false-positive risk as dispatch-processor's date search — re-verify with a real substring check.
    const verified = rawFolders.filter(f => f.name.includes(date));

    for (const folder of verified) {
      checked.push(folder.name);
      const isOneOnOne = / and /i.test(folder.name);
      if (isOneOnOne) continue; // one-on-one folders aren't expected to match any batch keyword

      const matchesSomeBatch = keywords.some(kw => folder.name.toLowerCase().includes(kw.toLowerCase()));
      if (matchesSomeBatch) continue;

      unmatched.push(folder.name);
      const alertKey = `unmatched_recording:${folder.name}`;
      if (dryRun) continue;
      if (await alreadyAlerted(alertKey)) continue;
      await sendTelegram(
        `⚠️ <b>Recording received but matched no batch</b>\n\n📁 ${folder.name}\n\n` +
        `No active batch's Zoom keyword appears in this folder name. If this is a real session, ` +
        `either rename the folder/Zoom meeting to include the right keyword, or update the batch's zoom_title_match.`
      );
      await recordAlert(alertKey);
      alerted.push(folder.name);
    }
  }

  return { checked, unmatched, alerted };
}

// ── Check 2: batches with no successful dispatch in a while ───────────────────
async function checkStaleBatches(dryRun: boolean): Promise<{ batches: string[]; stale: string[]; alerted: string[] }> {
  const { data: batches } = await sb.from("batch_groups").select("batch_name,created_at").eq("active", true);
  const cutoff = new Date(Date.now() - STALE_BATCH_DAYS * 86400000).toISOString();
  const today = isoDate(new Date());

  const stale: string[] = [];
  const alerted: string[] = [];

  for (const b of batches ?? []) {
    // Give a brand-new batch a full window before flagging it as stale.
    if (b.created_at && new Date(b.created_at).toISOString() > cutoff) continue;

    const { data: recent } = await sb.from("dispatch_logs").select("id").eq("batch_name", b.batch_name).in("status", ["success", "partial"]).gte("created_at", cutoff).limit(1);
    if (recent?.length) continue;

    stale.push(b.batch_name);
    const alertKey = `stale_batch:${b.batch_name}:${today}`;
    if (dryRun) continue;
    if (await alreadyAlerted(alertKey)) continue;
    await sendTelegram(
      `⚠️ <b>Batch may be going stale</b>\n\n📦 ${b.batch_name}\n\n` +
      `No successful dispatch in the last ${STALE_BATCH_DAYS} days. If this batch has had sessions recently, ` +
      `something in the pipeline may be failing before it ever reaches dispatch-processor. If it's just between ` +
      `sessions, this is a false alarm — safe to ignore.`
    );
    await recordAlert(alertKey);
    alerted.push(b.batch_name);
  }

  return { batches: (batches ?? []).map(b => b.batch_name), stale, alerted };
}

// ── Check 3: dispatches stuck waiting for a topic to be texted in ─────────────
// telegram-bot inserts a row with status "waiting_topic" when a recording is ready, then flips
// it to "pending" once the topic is texted in. If that text never happens (or the bot silently
// fails), dispatch-processor never sees the row at all — it only ever queries status="pending".
// This is a faster, more specific signal than the 7-day stale-batch check for that exact failure.
async function checkStuckWaitingTopic(dryRun: boolean): Promise<{ stuck: string[]; alerted: string[] }> {
  const cutoff = new Date(Date.now() - WAITING_TOPIC_STALE_HOURS * 3600000).toISOString();
  const { data } = await sb
    .from("pending_dispatches")
    .select("id,session_name,created_at")
    .eq("status", "waiting_topic")
    .lte("created_at", cutoff);

  const stuck: string[] = [];
  const alerted: string[] = [];

  for (const d of data ?? []) {
    stuck.push(d.session_name);
    const alertKey = `waiting_topic_stuck:${d.id}`;
    if (dryRun) continue;
    if (await alreadyAlerted(alertKey)) continue;
    await sendTelegram(
      `⏳ <b>Session stuck waiting for a topic</b>\n\n📛 ${d.session_name}\n` +
      `Created ${d.created_at}, still no topic texted in after ${WAITING_TOPIC_STALE_HOURS}h. ` +
      `Text the topic to the bot (or use /correct) to let it go out, or check /status.`
    );
    await recordAlert(alertKey);
    alerted.push(d.session_name);
  }

  return { stuck, alerted };
}

serve(async (req) => {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const url = new URL(req.url);
    const dryRun = body?.dry_run === true || url.searchParams.get("dry_run") === "true";

    // The Drive-dependent recording scan is isolated so a Google auth failure doesn't also
    // block the two checks below, which only need the database.
    let recordings: Awaited<ReturnType<typeof checkUnmatchedRecordings>> | { error: string };
    try {
      const tok = await gToken();
      recordings = await checkUnmatchedRecordings(tok, dryRun);
    } catch (e: any) {
      console.error("Recording scan skipped:", e.message);
      await sendTelegram(`🚨 dispatch-health-check: Google auth failed, recording scan skipped this run\n${e.message}`);
      recordings = { error: e.message };
    }

    const staleBatches = await checkStaleBatches(dryRun);
    const stuckTopics = await checkStuckWaitingTopic(dryRun);

    return new Response(JSON.stringify({ ok: true, dryRun, recordings, staleBatches, stuckTopics }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("dispatch-health-check failed:", e.message);
    await sendTelegram(`🚨 <b>dispatch-health-check itself failed</b>\n❌ ${e.message}`);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
