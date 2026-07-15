// supabase/functions/dispatch-processor/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND         = Deno.env.get("RESEND_API_KEY")!;
const SA             = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "anish@mindovermarkets.net";
const FROM_NAME      = Deno.env.get("FROM_NAME")  ?? "Anish | Mind Over Markets";
const CALENDLY_TOKEN = Deno.env.get("CALENDLY_ACCESS_TOKEN")!;
const CALENDLY_USER  = Deno.env.get("CALENDLY_USER_URI")!;
const BOT_TOKEN      = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID        = Deno.env.get("TELEGRAM_CHAT_ID")!;

// A one-on-one dispatch with no zoom_meeting_id match falls back to "nearest invitee by
// start_time on that date." Without a sanity window, a busy day can match a completely
// unrelated student's session (this is what sent the July 14 group email to Tincy).
const MAX_ONE_ON_ONE_DRIFT_MS = 6 * 60 * 60 * 1000; // 6 hours

type Recipient = { name: string; email: string };

async function sendTelegram(text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch (e: any) {
    // Notification failing must never mask the original error in the caller.
    console.error("Telegram notify failed:", e.message);
  }
}

async function notifyFailure(context: string, err: any): Promise<void> {
  const message = err?.message ?? String(err);
  console.error(`[dispatch-processor] ${context}:`, message);
  await sendTelegram(`🚨 <b>Dispatch-processor failure</b>\n📍 ${context}\n❌ ${message}`);
}

// ── Calendly sync ─────────────────────────────────────────────────────────────
async function syncCalendlyInvitees(): Promise<void> {
  try {
    const now    = new Date().toISOString();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const url    = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(CALENDLY_USER)}&min_start_time=${now}&max_start_time=${future}&status=active&count=100`;
    const res    = await fetch(url, { headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` } });
    const data   = await res.json();
    const events: any[] = data.collection ?? [];
    for (const event of events) {
      const eventUuid  = event.uri.split("/").pop();
      const detailRes  = await fetch(`https://api.calendly.com/scheduled_events/${eventUuid}`, { headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` } });
      const detailData = await detailRes.json();
      const location   = detailData.resource?.location;
      const zoomId     = location?.type === "zoom" ? String(location?.data?.id ?? "") : null;
      const invRes     = await fetch(`https://api.calendly.com/scheduled_events/${eventUuid}/invitees?count=50`, { headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` } });
      const invData    = await invRes.json();
      for (const inv of invData.collection ?? []) {
        await sb.from("session_invitees").upsert({
          event_uuid: eventUuid, event_name: event.name ?? "Session",
          event_type: "one_on_one", start_time: event.start_time,
          end_time: event.end_time, invitee_name: inv.name,
          invitee_email: inv.email, zoom_meeting_id: zoomId,
        }, { onConflict: "event_uuid,invitee_email" });
      }
    }
    console.log(`Calendly sync: ${events.length} events`);
  } catch(e: any) { console.error("Calendly sync:", e.message); }
}

// ── Google token ──────────────────────────────────────────────────────────────
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

// ── Drive: find recording ─────────────────────────────────────────────────────
type RecordingDebug = {
  searchStrategy: "date" | "student_name";
  searchTerm: string;
  groupIdentifier: string | null;
  folderQuery: string;
  rawFoldersFound: string[];   // whatever Drive's `contains` returned — may include false positives
  verifiedFolders: string[];   // survivors after a real client-side substring re-check
  scopedCandidates: string[];  // survivors after the group-identifier / one-on-one naming check
  chosenFolder: string | null;
  rejected: string | null;     // why we refused to pick, when we refused
  fileQuery: string | null;
  filesFound: string[];
  matched: string | null;
};

async function findRecording(tok: string, dispatch: any, sessionType: "group" | "one_on_one", groupIdentifier: string | null): Promise<{ url: string | null; debug: RecordingDebug }> {
  const sessionName = dispatch.session_name ?? "";
  const date = dispatch.meeting_date ?? "";

  // Group recordings live wherever Zoom's own auto-sync drops them, named
  // "YYYY-MM-DD HH.MM.SS <Zoom meeting topic>" — that topic text is whatever the Zoom
  // meeting itself is titled and has no guaranteed relationship to our batch_name/session_name,
  // so the date is the only reliably matchable anchor. One-on-one recordings are manually
  // organized into per-student folders, so the student-name heuristic still applies there.
  const useDateStrategy = sessionType === "group";
  const searchTerm = useDateStrategy ? date : sessionName.split(" and ")[0].trim();
  const safeTerm = searchTerm.replace(/'/g, "\\'");

  const debug: RecordingDebug = {
    searchStrategy: useDateStrategy ? "date" : "student_name",
    searchTerm: safeTerm, groupIdentifier: useDateStrategy ? groupIdentifier : null,
    folderQuery: "", rawFoldersFound: [], verifiedFolders: [], scopedCandidates: [],
    chosenFolder: null, rejected: null, fileQuery: null, filesFound: [], matched: null,
  };

  if (!safeTerm) { debug.rejected = "No search term available (missing meeting_date/session_name)."; return { url: null, debug }; }

  // Drive's `name contains` operator tokenizes on non-alphanumeric characters instead of doing
  // a true contiguous substring match — a hyphenated date like "2026-07-14" can spuriously match
  // an unrelated folder that happens to contain "2026", "07" and "14" scattered anywhere in its
  // name (this is exactly how a stray April folder matched a July 14 date search: 2026 from the
  // year, 07 from "04-07", 14 from the "20.28.14" timestamp — coincidence, not a real match).
  // Drive's query is only used to narrow candidates; every one is re-verified below with a real
  // JS substring check before it's trusted.
  const folderQuery = `mimeType='application/vnd.google-apps.folder' and name contains '${safeTerm}' and trashed=false`;
  debug.folderQuery = folderQuery;
  const folderRes  = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)&orderBy=createdTime desc&pageSize=20`, { headers:{Authorization:`Bearer ${tok}`} });
  const rawFolders: any[] = (await folderRes.json()).files ?? [];
  debug.rawFoldersFound = rawFolders.map(f => f.name);

  let candidates = rawFolders.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  debug.verifiedFolders = candidates.map(f => f.name);

  if (useDateStrategy) {
    // A date match alone isn't enough to prove a folder belongs to THIS batch — require the
    // Zoom title keyword too, so a same-day unrelated recording (e.g. a 1-on-1) can never be
    // picked for a group send.
    if (!groupIdentifier) {
      debug.rejected = "No zoom_title_match/batch_name configured on this batch — cannot confirm which same-date folder belongs to it.";
      candidates = [];
    } else {
      candidates = candidates.filter(f => f.name.toLowerCase().includes(groupIdentifier.toLowerCase()));
    }
  } else {
    // Zoom's own one-on-one recordings are named "<Student> and Anish ..." — require that
    // literal marker so a coincidentally name-matching group folder can never be picked here.
    candidates = candidates.filter(f => / and /i.test(f.name));
  }
  debug.scopedCandidates = candidates.map(f => f.name);

  console.log(`Recording folder search (${debug.searchStrategy}) "${safeTerm}": raw=${debug.rawFoldersFound.length} verified=${debug.verifiedFolders.length} scoped=${debug.scopedCandidates.length}`);

  if (!debug.verifiedFolders.length) {
    // Nothing at all for this date/name yet — most likely still syncing, not an error.
    return { url: null, debug };
  }

  if (!candidates.length) {
    if (!debug.rejected) debug.rejected = `${debug.verifiedFolders.length} folder(s) matched "${safeTerm}" but none matched the required ${useDateStrategy ? `group identifier "${groupIdentifier}"` : "one-on-one naming pattern"} — refusing to guess.`;
    throw new Error(`Recording folder lookup for "${dispatch.session_name}" is unsafe: ${debug.rejected}`);
  }
  if (candidates.length > 1) {
    debug.rejected = `${candidates.length} folders all matched (${debug.scopedCandidates.join(" | ")}) — refusing to guess which one is correct.`;
    throw new Error(`Recording folder lookup for "${dispatch.session_name}" is ambiguous: ${debug.rejected}`);
  }

  const folder = candidates[0];
  debug.chosenFolder = folder.name;

  // Broadened from an exact 'video/mp4' match — Drive doesn't always detect that exact
  // mimeType for a synced Zoom recording (.mov, generic video/*, etc. also show up here).
  const fileQuery = `mimeType contains 'video/' and '${folder.id}' in parents and trashed=false`;
  debug.fileQuery = fileQuery;
  const videoRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQuery)}&fields=files(id,name,webViewLink,mimeType)&pageSize=5`, { headers:{Authorization:`Bearer ${tok}`} });
  const videos: any[] = (await videoRes.json()).files ?? [];
  debug.filesFound = videos.map(f => `${f.name} (${f.mimeType})`);
  console.log(`Video files in "${folder.name}": ${debug.filesFound.join(", ") || "none"}`);

  const match = videos[0] ?? null;
  debug.matched = match?.name ?? null;
  return { url: match?.webViewLink ?? null, debug };
}

// ── Drive: find notes for ONE topic ──────────────────────────────────────────
type NotesDebug = {
  topic: string;
  directFileQuery: string;
  directFilesFound: string[];
  folderQuery: string | null;
  foldersFound: string[];
  chosenFolder: string | null;
  folderFileQuery: string | null;
  folderFilesFound: string[];
};

async function findNotesForTopic(tok: string, topic: string): Promise<{ links: {label:string;url:string}[]; debug: NotesDebug }> {
  const safe   = topic.trim().replace(/'/g, "\\'");
  const safeUs = safe.replace(/\s+/g, "_"); // space→underscore

  const debug: NotesDebug = {
    topic: safe, directFileQuery: "", directFilesFound: [],
    folderQuery: null, foldersFound: [], chosenFolder: null,
    folderFileQuery: null, folderFilesFound: [],
  };

  // Step 1: Search for PDF files directly (space and underscore variants)
  const fileQ = `(name contains '${safe}' or name contains '${safeUs}') and (mimeType='application/pdf' or mimeType contains 'document') and trashed=false`;
  debug.directFileQuery = fileQ;
  const fileRes  = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQ)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=10`, { headers:{Authorization:`Bearer ${tok}`} });
  const files: any[] = (await fileRes.json()).files ?? [];
  debug.directFilesFound = files.map(f => f.name);
  console.log(`Notes file search "${safe}": ${files.length} found`);
  if (files.length) return { links: files.map(f => ({ label: f.name.replace(/\.[^.]+$/, "").replace(/_/g, " "), url: f.webViewLink })), debug };

  // Step 2: Search for a folder by topic name, return ALL PDFs inside
  const folderQ   = `(name contains '${safe}' or name contains '${safeUs}') and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  debug.folderQuery = folderQ;
  const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQ)}&fields=files(id,name)&pageSize=5`, { headers:{Authorization:`Bearer ${tok}`} });
  const folders: any[] = (await folderRes.json()).files ?? [];
  debug.foldersFound = folders.map(f => f.name);
  console.log(`Notes folder search "${safe}": ${folders.length} found`);
  if (!folders.length) return { links: [], debug };

  debug.chosenFolder = folders[0].name;
  const folderId = folders[0].id;
  const folderFileQuery = `'${folderId}' in parents and (mimeType='application/pdf' or mimeType contains 'document') and trashed=false`;
  debug.folderFileQuery = folderFileQuery;
  const pdfRes   = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderFileQuery)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=20`, { headers:{Authorization:`Bearer ${tok}`} });
  const pdfs: any[] = (await pdfRes.json()).files ?? [];
  debug.folderFilesFound = pdfs.map(f => f.name);
  console.log(`PDFs in folder "${folders[0].name}": ${pdfs.map(f=>f.name).join(", ")}`);
  return { links: pdfs.map(f => ({ label: f.name.replace(/\.[^.]+$/, "").replace(/_/g, " "), url: f.webViewLink })), debug };
}

// ── Recipient resolution ──────────────────────────────────────────────────────
// Normalizes session_type so a typo/casing mismatch (e.g. "Group" instead of "group")
// can never silently fall through to the one-on-one lookup — that fallthrough is what
// sent the July 14 group-session email to a one-on-one student (Tincy).
function normalizeSessionType(raw: unknown): "group" | "one_on_one" | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "group") return "group";
  if (s === "one_on_one" || s === "1on1" || s === "1-on-1" || s === "individual" || s === "private") return "one_on_one";
  return null;
}

async function resolveGroupRecipients(dispatch: any): Promise<{ recipients: Recipient[]; zoomTitleMatch: string | null }> {
  if (!dispatch.batch_name) {
    throw new Error(`Group dispatch "${dispatch.session_name}" has no batch_name set — refusing to guess a batch.`);
  }

  const { data: batch, error } = await sb
    .from("batch_groups")
    .select("batch_name,students,active,zoom_title_match")
    .eq("batch_name", dispatch.batch_name)
    .maybeSingle();

  if (error) {
    throw new Error(`batch_groups lookup failed for "${dispatch.batch_name}": ${error.message}`);
  }
  if (!batch) {
    throw new Error(`No batch_groups row found with batch_name "${dispatch.batch_name}" — a group session must never fall back to a different recipient source.`);
  }
  if (batch.active === false) {
    throw new Error(`batch_groups "${dispatch.batch_name}" is marked inactive — refusing to dispatch to a deactivated batch (looks like leftover/stale config).`);
  }

  return { recipients: (batch.students as Recipient[]) ?? [], zoomTitleMatch: batch.zoom_title_match ?? null };
}

async function resolveOneOnOneRecipients(dispatch: any): Promise<Recipient[]> {
  if (dispatch.zoom_meeting_id) {
    const { data: byZoom, error } = await sb
      .from("session_invitees")
      .select("invitee_name,invitee_email")
      .eq("zoom_meeting_id", dispatch.zoom_meeting_id)
      .eq("event_type", "one_on_one");
    if (error) throw new Error(`session_invitees lookup by zoom_meeting_id failed: ${error.message}`);
    if (byZoom?.length) return byZoom.map(i => ({ name: i.invitee_name, email: i.invitee_email }));
  }

  if (!dispatch.meeting_date) {
    throw new Error(`One-on-one dispatch "${dispatch.session_name}" has no zoom_meeting_id match and no meeting_date to fall back on.`);
  }

  const { data: byDate, error } = await sb
    .from("session_invitees")
    .select("invitee_name,invitee_email,start_time")
    .gte("start_time", `${dispatch.meeting_date}T00:00:00Z`)
    .lte("start_time", `${dispatch.meeting_date}T23:59:59Z`)
    .eq("event_type", "one_on_one");
  if (error) throw new Error(`session_invitees lookup by date failed: ${error.message}`);
  if (!byDate?.length) return [];
  if (!dispatch.meeting_start_time) {
    // Multiple candidates on the date and nothing to disambiguate with — do not guess.
    if (byDate.length > 1) {
      throw new Error(`${byDate.length} one-on-one invitees on ${dispatch.meeting_date} and no meeting_start_time to disambiguate — refusing to pick one at random.`);
    }
    return [{ name: byDate[0].invitee_name, email: byDate[0].invitee_email }];
  }

  const mt = new Date(dispatch.meeting_start_time).getTime();
  const sorted = [...byDate].sort((a, b) =>
    Math.abs(new Date(a.start_time).getTime() - mt) - Math.abs(new Date(b.start_time).getTime() - mt)
  );
  const nearest = sorted[0];
  const drift = Math.abs(new Date(nearest.start_time).getTime() - mt);
  if (drift > MAX_ONE_ON_ONE_DRIFT_MS) {
    throw new Error(`Nearest one-on-one invitee (${nearest.invitee_name}) on ${dispatch.meeting_date} is ${Math.round(drift / 60000)} min from the dispatched meeting time — outside the ${MAX_ONE_ON_ONE_DRIFT_MS / 3600000}h match window, refusing to guess.`);
  }

  return [{ name: nearest.invitee_name, email: nearest.invitee_email }];
}

async function resolveRecipients(dispatch: any): Promise<{ sessionType: "group" | "one_on_one"; recipients: Recipient[]; groupIdentifier: string | null }> {
  const sessionType = normalizeSessionType(dispatch.session_type);
  if (!sessionType) {
    throw new Error(`Unknown session_type "${dispatch.session_type}" on dispatch "${dispatch.session_name}" — expected "group" or "one_on_one". Refusing to guess recipients.`);
  }

  let recipients: Recipient[];
  let groupIdentifier: string | null = null;
  if (sessionType === "group") {
    const resolved = await resolveGroupRecipients(dispatch);
    recipients = resolved.recipients;
    // zoom_title_match is the field this CRM already asks for specifically because it's
    // "the keyword that appears in the Zoom meeting title" — the same identifier a synced
    // recording folder's name is built from, so it's what confirms a folder actually belongs
    // to this batch rather than just happening to fall on the same date.
    groupIdentifier = resolved.zoomTitleMatch || dispatch.batch_name || null;
  } else {
    recipients = await resolveOneOnOneRecipients(dispatch);
  }

  validateRecipients(dispatch, sessionType, recipients);
  return { sessionType, recipients, groupIdentifier };
}

// ── Guardrails ─────────────────────────────────────────────────────────────────
function validateRecipients(dispatch: any, sessionType: "group" | "one_on_one", recipients: Recipient[]): void {
  if (!recipients.length) {
    throw new Error(`Resolved 0 recipients for "${dispatch.session_name}" (session_type=${sessionType}) — aborting rather than sending nothing silently.`);
  }
  const missingEmail = recipients.find(r => !r.email || !r.email.includes("@"));
  if (missingEmail) {
    throw new Error(`Recipient "${missingEmail.name ?? "unknown"}" for "${dispatch.session_name}" has no valid email — aborting.`);
  }
  if (sessionType === "one_on_one" && recipients.length > 1) {
    throw new Error(`One-on-one dispatch "${dispatch.session_name}" resolved ${recipients.length} recipients — expected exactly 1. Aborting rather than guessing which is correct.`);
  }
}

// ── Final-session detection ───────────────────────────────────────────────────
// The dispatch schema has no session-number/total-sessions column to compare against,
// so the reliable signal is the topic/folder name — "Trade Management" is the last
// module taught in the program and is always dispatched under that name.
function isFinalSessionDispatch(sessionName: string, topics: string[]): boolean {
  const FINAL_SESSION_MARKER = /trade management/i;
  return FINAL_SESSION_MARKER.test(sessionName) || topics.some(t => FINAL_SESSION_MARKER.test(t));
}

function finalSessionThankYouHtml(): string {
  return `<div style="margin-top:28px;padding-top:24px;border-top:2px solid #D4A843">
  <p style="color:#D4A843;font-size:12px;letter-spacing:1.5px;font-weight:700;margin:0 0 14px;text-transform:uppercase">A Personal Note from Anish</p>
  <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 14px">As this is the final session of your batch, I want to take a moment to say thank you. Thank you for trusting me and for committing to the Mind Over Markets mentorship program. Watching you grow over these weeks has been the most rewarding part of what I do.</p>
  <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 14px">The strategies and concepts we covered will only take you as far as your discipline allows. Trust your edge, respect your risk, protect your capital, and never let one trade define you. The market rewards patience and punishes impulse, so stay on the right side of that.</p>
  <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 14px">This isn't goodbye. You're part of the MOM community now, and my door is always open whenever you need guidance.</p>
  <p style="color:#555;line-height:1.75;font-size:14px;margin:0 0 18px">Wishing you a disciplined, consistent, and profitable trading journey ahead.</p>
  <p style="color:#1a1f3e;font-size:14px;margin:0"><strong>Trade well,</strong><br>Anish<br><span style="color:#aaa;font-size:12px">Mind Over Markets</span></p>
</div>`;
}

// ── Email content (pure — no network call) ────────────────────────────────────
function buildEmailContent(name: string, session: string, topics: string[], rec: string|null, notesLinks: {label:string;url:string}[], isFinalSession: boolean): { subject: string; html: string } {
  const rb = rec
    ? `<div style="text-align:center;margin:22px 0"><a href="${rec}" style="background:#D4A843;color:#07091A;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">📹 Watch Recording</a></div>`
    : `<p style="color:#999;text-align:center;font-size:13px">Recording is still syncing — available shortly.</p>`;

  const notesButtons = notesLinks.map(n =>
    `<div style="text-align:center;margin:10px 0">
       <a href="${n.url}" style="background:#111830;color:#D4A843;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;border:1px solid #D4A843;display:inline-block">📝 ${n.label}</a>
     </div>`
  ).join("");

  const topicLine = topics.length
    ? `<p style="color:#D4A843;font-size:13px;text-align:center;margin:0 0 16px">📚 Today's Topics: <strong>${topics.join(" · ")}</strong></p>`
    : "";

  const closing = isFinalSession
    ? finalSessionThankYouHtml()
    : `<p style="color:#777;font-size:13px;margin-top:24px">Keep showing up. Every rep compounds.<br><br>— Anish<br><span style="color:#aaa;font-size:12px">Mind Over Markets</span></p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body style="margin:0;padding:0;background:#f0f0f5;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;border-radius:14px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#07091A,#1a1f3e);padding:36px 32px;text-align:center">
    <p style="color:#D4A843;font-size:11px;letter-spacing:3px;margin:0 0 10px">MIND OVER MARKETS</p>
    <h1 style="color:#fff;font-size:20px;margin:0">${session}</h1>
  </div>
  <div style="background:#fff;padding:36px 32px">
    <p style="color:#1a1f3e;font-size:16px">Hi ${name},</p>
    <p style="color:#555;line-height:1.75;font-size:14px">Here is everything from today's session. Take your time going through it.</p>
    ${topicLine}
    ${rb}
    ${notesButtons || `<p style="color:#999;text-align:center;font-size:13px">Notes coming soon.</p>`}
    ${closing}
  </div>
</div></body></html>`;

  const subjectTopics = topics.length ? ` – ${topics.join(" & ")}` : "";
  const subject = `[Mind Over Markets] ${session}${subjectTopics} – Recording & Notes`;
  return { subject, html };
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<{ok:boolean;error?:string}> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{Authorization:`Bearer ${RESEND}`,"Content-Type":"application/json"},
      body:JSON.stringify({ from:`${FROM_NAME} <${FROM_EMAIL}>`, to:[to], subject, html })
    });
    const d = await r.json();
    if (!r.ok) return { ok:false, error: d.message };
    return { ok:true };
  } catch(e:any) { return { ok:false, error:e.message }; }
}

// ── Process one dispatch ──────────────────────────────────────────────────────
type DispatchResult = {
  sessionType: "group" | "one_on_one";
  recipients: Recipient[];
  recording: string | null;
  recordingDebug: RecordingDebug;
  topics: string[];
  notesLinks: { label: string; url: string }[];
  notesDebug: NotesDebug[];
  isFinalSession: boolean;
  emails: { to: string; name: string; subject: string; html: string; result: { ok: boolean; error?: string } }[];
};

async function runDispatch(dispatch: any, tok: string, opts: { dryRun: boolean }): Promise<DispatchResult> {
  const { sessionType, recipients, groupIdentifier } = await resolveRecipients(dispatch);

  const { url: rec, debug: recordingDebug } = await findRecording(tok, dispatch, sessionType, groupIdentifier);

  const topicStr = (dispatch.notes_topic ?? "").trim();
  const topics   = topicStr ? topicStr.split(",").map((t:string) => t.trim()).filter(Boolean) : [];

  let allNotesLinks: {label:string;url:string}[] = [];
  const notesDebug: NotesDebug[] = [];
  for (const topic of topics) {
    const { links, debug } = await findNotesForTopic(tok, topic);
    allNotesLinks = [...allNotesLinks, ...links];
    notesDebug.push(debug);
  }
  allNotesLinks = allNotesLinks.filter((n, i, arr) => arr.findIndex(x => x.url === n.url) === i);

  const isFinalSession = isFinalSessionDispatch(dispatch.session_name ?? "", topics);

  console.log(`[${opts.dryRun ? "DRY RUN" : "LIVE"}] session_type=${sessionType} recipients=[${recipients.map(r=>`${r.name}<${r.email}>`).join(", ")}] | Topics: [${topics.join(", ")}] | Notes found: ${allNotesLinks.length} | Recording: ${rec ?? "not found"} | Final session: ${isFinalSession}`);

  const emails: DispatchResult["emails"] = [];
  for (const r of recipients) {
    const { subject, html } = buildEmailContent(r.name, dispatch.session_name, topics, rec, allNotesLinks, isFinalSession);
    if (opts.dryRun) {
      console.log(`[DRY RUN] Would send to ${r.name} <${r.email}>\nSubject: ${subject}`);
      emails.push({ to: r.email, name: r.name, subject, html, result: { ok: true } });
    } else {
      const result = await sendResendEmail(r.email, subject, html);
      emails.push({ to: r.email, name: r.name, subject, html, result });
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
  }

  if (opts.dryRun) {
    await sendTelegram(
      `🧪 <b>DRY RUN — no emails sent</b>\n\n` +
      `📛 ${dispatch.session_name}\n` +
      `🏷 session_type: ${sessionType}${sessionType === "group" ? ` (batch: ${dispatch.batch_name})` : ""}\n` +
      `👤 Would send to: ${recipients.map(r=>`${r.name} <${r.email}>`).join(", ")}\n` +
      `📹 Recording: ${rec ? "Found ✅" : "Not found ❌"}\n` +
      `📝 Notes (${topics.join(", ") || "no topic"}): ${allNotesLinks.length > 0 ? `${allNotesLinks.length} file(s) ✅` : "Not found ❌"}`
    );
  } else {
    const sent = emails.filter(e => e.result.ok).length;
    await sb.from("dispatch_logs").insert({
      pending_dispatch_id: dispatch.id ?? null,
      session_name: dispatch.session_name, zoom_meeting_id: dispatch.zoom_meeting_id,
      session_type: dispatch.session_type,
      recording_url: rec,
      notes_url: allNotesLinks[0]?.url ?? null,
      recipients: emails.map(e => ({ name: e.name, email: e.to, status: e.result.ok ? "sent" : "failed", error: e.result.error })),
      sent_count: sent, total_count: recipients.length,
      status: sent===recipients.length?"success":sent>0?"partial":"failed",
    });

    await sendTelegram(
      `✅ <b>Emails sent!</b>\n\n` +
      `📛 ${dispatch.session_name}\n` +
      `🏷 session_type: ${sessionType}${sessionType === "group" ? ` (batch: ${dispatch.batch_name})` : ""}\n` +
      `👤 ${recipients.map(r=>r.name).join(", ")}\n` +
      `📹 Recording: ${rec ? "Found ✅" : "Not found ❌"}\n` +
      `📝 Notes (${topics.join(", ") || "no topic"}): ${allNotesLinks.length > 0 ? `${allNotesLinks.length} file(s) ✅` : "Not found ❌"}\n` +
      `📧 ${sent}/${recipients.length} emails sent` +
      (isFinalSession ? `\n🎓 Final-session thank-you note included` : "")
    );

    if (!sent) throw new Error("All emails failed to send (see dispatch_logs for per-recipient errors).");
  }

  return { sessionType, recipients, recording: rec, recordingDebug, topics, notesLinks: allNotesLinks, notesDebug, isFinalSession, emails };
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  let body: any = {};
  try { body = await req.json(); } catch { /* no/empty body is fine — e.g. cron invocation */ }
  const url    = new URL(req.url);
  const dryRun = body?.dry_run === true || url.searchParams.get("dry_run") === "true";

  // Ad-hoc test mode: POST { dispatch: {...}, dry_run: true } to resolve recipients and
  // render the email for a hand-built dispatch WITHOUT touching pending_dispatches at all.
  // This is the safe way to test group vs one-on-one recipient resolution before a live session.
  if (body?.dispatch) {
    let tok: string;
    try { tok = await gToken(); }
    catch (e: any) {
      await notifyFailure("ad-hoc test: Google auth", e);
      return new Response(JSON.stringify({ ok:false, error:"Google auth failed: "+e.message }), { status:500 });
    }
    try {
      const result = await runDispatch(body.dispatch, tok, { dryRun });
      return new Response(JSON.stringify({ ok:true, dryRun, ...result }, null, 2), { status:200, headers:{"Content-Type":"application/json"} });
    } catch (e: any) {
      if (!dryRun) await notifyFailure(`ad-hoc dispatch "${body.dispatch?.session_name}"`, e);
      return new Response(JSON.stringify({ ok:false, dryRun, error: e.message }), { status:500 });
    }
  }

  await syncCalendlyInvitees();

  const { data: pending, error } = await sb.from("pending_dispatches").select("*").eq("status","pending").lte("scheduled_at", new Date().toISOString()).limit(10);
  if (error) {
    await notifyFailure("fetching pending_dispatches", error);
    return new Response(JSON.stringify({error:error.message}), {status:500});
  }
  if (!pending?.length) return new Response(JSON.stringify({ok:true,pending:0}), {status:200});

  let tok: string;
  try { tok = await gToken(); }
  catch(e:any) {
    await notifyFailure("Google auth (blocks all pending dispatches this run)", e);
    return new Response("Google auth failed: "+e.message, {status:500});
  }

  const results: { id: string; session_name: string; ok: boolean; error?: string }[] = [];
  for (const d of pending) {
    if (!dryRun) await sb.from("pending_dispatches").update({status:"processing"}).eq("id", d.id);
    try {
      await runDispatch(d, tok, { dryRun });
      if (!dryRun) await sb.from("pending_dispatches").update({status:"done"}).eq("id", d.id);
      results.push({ id: d.id, session_name: d.session_name, ok: true });
    } catch(e:any) {
      if (!dryRun) {
        await sb.from("pending_dispatches").update({status:"failed", error:e.message}).eq("id", d.id);
        await sb.from("dispatch_logs").insert({
          pending_dispatch_id: d.id, session_name: d.session_name, zoom_meeting_id: d.zoom_meeting_id,
          session_type: d.session_type, recording_url: null, notes_url: null,
          recipients: [], sent_count: 0, total_count: 0, status: "failed", error: e.message,
        });
      }
      if (!dryRun) await notifyFailure(`dispatch "${d.session_name}" (id ${d.id})`, e);
      results.push({ id: d.id, session_name: d.session_name, ok: false, error: e.message });
    }
  }
  return new Response(JSON.stringify({processed:pending.length, dryRun, results}, null, 2), {status:200, headers:{"Content-Type":"application/json"}});
});
