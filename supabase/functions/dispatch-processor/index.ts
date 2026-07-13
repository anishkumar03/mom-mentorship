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

async function sendTelegram(text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });
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
async function findRecording(tok: string, sessionName: string, date: string): Promise<string|null> {
  const studentName = sessionName.split(" and ")[0].trim().replace(/'/g, "\\'");
  const folderQ = `mimeType='application/vnd.google-apps.folder' and name contains '${studentName}' and trashed=false`;
  const folderRes  = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQ)}&fields=files(id,name)&orderBy=createdTime desc&pageSize=5`, { headers:{Authorization:`Bearer ${tok}`} });
  const folders: any[] = (await folderRes.json()).files ?? [];
  console.log(`Recording folder search "${studentName}": ${folders.length} found`);
  if (!folders.length) return null;
  let folderId = folders[0].id;
  if (folders.length > 1 && date) {
    const dateFolder = folders.find(f => f.name.includes(date));
    if (dateFolder) folderId = dateFolder.id;
  }
  const mp4Res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`mimeType='video/mp4' and '${folderId}' in parents and trashed=false`)}&fields=files(id,name,webViewLink)&pageSize=3`, { headers:{Authorization:`Bearer ${tok}`} });
  const mp4s: any[] = (await mp4Res.json()).files ?? [];
  return mp4s[0]?.webViewLink ?? null;
}

// ── Drive: find notes for ONE topic ──────────────────────────────────────────
async function findNotesForTopic(tok: string, topic: string): Promise<{label:string;url:string}[]> {
  const safe   = topic.trim().replace(/'/g, "\\'");
  const safeUs = safe.replace(/\s+/g, "_"); // space→underscore

  // Step 1: Search for PDF files directly (space and underscore variants)
  const fileQ = `(name contains '${safe}' or name contains '${safeUs}') and (mimeType='application/pdf' or mimeType contains 'document') and trashed=false`;
  const fileRes  = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQ)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=10`, { headers:{Authorization:`Bearer ${tok}`} });
  const files: any[] = (await fileRes.json()).files ?? [];
  console.log(`Notes file search "${safe}": ${files.length} found`);
  if (files.length) return files.map(f => ({ label: f.name.replace(/\.[^.]+$/, "").replace(/_/g, " "), url: f.webViewLink }));

  // Step 2: Search for a folder by topic name, return ALL PDFs inside
  const folderQ   = `(name contains '${safe}' or name contains '${safeUs}') and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQ)}&fields=files(id,name)&pageSize=5`, { headers:{Authorization:`Bearer ${tok}`} });
  const folders: any[] = (await folderRes.json()).files ?? [];
  console.log(`Notes folder search "${safe}": ${folders.length} found`);
  if (!folders.length) return [];

  const folderId = folders[0].id;
  const pdfRes   = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and (mimeType='application/pdf' or mimeType contains 'document') and trashed=false`)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=20`, { headers:{Authorization:`Bearer ${tok}`} });
  const pdfs: any[] = (await pdfRes.json()).files ?? [];
  console.log(`PDFs in folder "${folders[0].name}": ${pdfs.map(f=>f.name).join(", ")}`);
  return pdfs.map(f => ({ label: f.name.replace(/\.[^.]+$/, "").replace(/_/g, " "), url: f.webViewLink }));
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

// ── Send email (supports multiple notes) ─────────────────────────────────────
async function mail(to: string, name: string, session: string, topics: string[], rec: string|null, notesLinks: {label:string;url:string}[], isFinalSession: boolean): Promise<{ok:boolean;error?:string}> {
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

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f0f5;font-family:Arial,sans-serif">
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

  try {
    const subjectTopics = topics.length ? ` – ${topics.join(" & ")}` : "";
    const r = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{Authorization:`Bearer ${RESEND}`,"Content-Type":"application/json"},
      body:JSON.stringify({ from:`${FROM_NAME} <${FROM_EMAIL}>`, to:[to], subject:`[Mind Over Markets] ${session}${subjectTopics} – Recording & Notes`, html })
    });
    const d = await r.json();
    if (!r.ok) return { ok:false, error: d.message };
    return { ok:true };
  } catch(e:any) { return { ok:false, error:e.message }; }
}

// ── Process one dispatch ──────────────────────────────────────────────────────
async function runDispatch(dispatch: any, tok: string): Promise<void> {
  let recips: {name:string;email:string}[] = [];

  if (dispatch.session_type === "group") {
    const { data: b } = await sb.from("batch_groups").select("students").eq("batch_name", dispatch.batch_name).single();
    recips = (b?.students as any[]) ?? [];
  } else {
    if (dispatch.zoom_meeting_id) {
      const { data: byZoom } = await sb.from("session_invitees").select("invitee_name,invitee_email").eq("zoom_meeting_id", dispatch.zoom_meeting_id);
      recips = (byZoom ?? []).map(i => ({ name: i.invitee_name, email: i.invitee_email }));
    }
    if (!recips.length) {
      const { data: byDate } = await sb.from("session_invitees").select("invitee_name,invitee_email,start_time")
        .gte("start_time", `${dispatch.meeting_date}T00:00:00Z`)
        .lte("start_time", `${dispatch.meeting_date}T23:59:59Z`)
        .eq("event_type", "one_on_one");
      if (byDate?.length && dispatch.meeting_start_time) {
        const mt = new Date(dispatch.meeting_start_time).getTime();
        const sorted = byDate.sort((a,b) => Math.abs(new Date(a.start_time).getTime()-mt) - Math.abs(new Date(b.start_time).getTime()-mt));
        recips = [{ name: sorted[0].invitee_name, email: sorted[0].invitee_email }];
      }
    }
  }

  if (!recips.length) throw new Error(`No recipients for "${dispatch.session_name}"`);

  // Recording
  const rec = await findRecording(tok, dispatch.session_name, dispatch.meeting_date);

  // Notes — parse comma-separated topics, find ALL PDFs for each
  const topicStr = (dispatch.notes_topic ?? "").trim();
  const topics   = topicStr ? topicStr.split(",").map((t:string) => t.trim()).filter(Boolean) : [];

  let allNotesLinks: {label:string;url:string}[] = [];
  for (const topic of topics) {
    const links = await findNotesForTopic(tok, topic);
    allNotesLinks = [...allNotesLinks, ...links];
  }

  // Remove duplicate URLs
  allNotesLinks = allNotesLinks.filter((n, i, arr) => arr.findIndex(x => x.url === n.url) === i);

  const isFinalSession = isFinalSessionDispatch(dispatch.session_name ?? "", topics);

  console.log(`Topics: [${topics.join(", ")}] | Notes found: ${allNotesLinks.length} | Recording: ${rec ?? "not found"} | Final session: ${isFinalSession}`);

  const log: {name:string;email:string;status:string;error?:string}[] = [];
  for (const r of recips) {
    const result = await mail(r.email, r.name, dispatch.session_name, topics, rec, allNotesLinks, isFinalSession);
    log.push({ name:r.name, email:r.email, status: result.ok?"sent":"failed", error: result.error });
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  const sent = log.filter(r => r.status==="sent").length;
  await sb.from("dispatch_logs").insert({
    session_name: dispatch.session_name, zoom_meeting_id: dispatch.zoom_meeting_id,
    session_type: dispatch.session_type,
    recording_url: rec,
    notes_url: allNotesLinks[0]?.url ?? null,
    recipients: log, sent_count: sent, total_count: recips.length,
    status: sent===recips.length?"success":sent>0?"partial":"failed",
  });

  await sendTelegram(
    `✅ <b>Emails sent!</b>\n\n` +
    `👤 ${recips.map(r=>r.name).join(", ")}\n` +
    `📹 Recording: ${rec ? "Found ✅" : "Not found ❌"}\n` +
    `📝 Notes (${topics.join(", ") || "no topic"}): ${allNotesLinks.length > 0 ? `${allNotesLinks.length} file(s) ✅` : "Not found ❌"}\n` +
    `📧 ${sent}/${recips.length} emails sent` +
    (isFinalSession ? `\n🎓 Final-session thank-you note included` : "")
  );

  if (!sent) throw new Error("All emails failed");
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async () => {
  await syncCalendlyInvitees();
  const { data: pending, error } = await sb.from("pending_dispatches").select("*").eq("status","pending").lte("scheduled_at", new Date().toISOString()).limit(10);
  if (error) return new Response(JSON.stringify({error:error.message}), {status:500});
  if (!pending?.length) return new Response(JSON.stringify({ok:true,pending:0}), {status:200});
  let tok: string;
  try { tok = await gToken(); } catch(e:any) { return new Response("Google auth failed: "+e.message, {status:500}); }
  for (const d of pending) {
    await sb.from("pending_dispatches").update({status:"processing"}).eq("id", d.id);
    try { await runDispatch(d, tok); await sb.from("pending_dispatches").update({status:"done"}).eq("id", d.id); }
    catch(e:any) { console.error(`Failed: ${e.message}`); await sb.from("pending_dispatches").update({status:"failed", error:e.message}).eq("id", d.id); }
  }
  return new Response(JSON.stringify({processed:pending.length}), {status:200});
});
