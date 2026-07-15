// supabase/functions/telegram-bot/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb         = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BOT_TOKEN  = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ALLOWED_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;

async function send(chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let update: any;
  try { update = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const message = update?.message;
  if (!message) return new Response("No message", { status: 200 });

  const chatId = String(message.chat?.id ?? "");
  const text   = (message.text ?? "").trim();

  if (chatId !== ALLOWED_ID) {
    await send(chatId, "⛔ Unauthorized");
    return new Response("OK", { status: 200 });
  }

  // ── /status — show all pending dispatches ────────────────────────────────
  if (text === "/status") {
    const { data } = await sb
      .from("pending_dispatches")
      .select("session_name, status, notes_topic, scheduled_at")
      .in("status", ["waiting_topic", "pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (!data || data.length === 0) {
      await send(chatId, "✅ No pending sessions right now.");
    } else {
      const lines = data.map(d => {
        const fireAt = new Date(d.scheduled_at);
        const diffMin = Math.max(0, Math.round((fireAt.getTime() - Date.now()) / 60000));
        const statusEmoji = d.status === "waiting_topic" ? "⏳" : "🔄";
        return `${statusEmoji} <b>${d.session_name}</b>\n   Topic: ${d.notes_topic ?? "not set yet"}\n   Fires in: ${diffMin} min`;
      });
      await send(chatId, `📋 <b>Pending Sessions:</b>\n\n${lines.join("\n\n")}`);
    }
    return new Response("OK", { status: 200 });
  }

  // ── /correct <topic> — fix the topic of most recent pending dispatch ──────
  if (text.startsWith("/correct ")) {
    const newTopic = text.replace("/correct ", "").trim();
    if (!newTopic) {
      await send(chatId, "Usage: /correct Fair Value Gap");
      return new Response("OK", { status: 200 });
    }

    // Find most recent dispatch that has a topic set (pending or waiting)
    const { data } = await sb
      .from("pending_dispatches")
      .select("*")
      .in("status", ["pending", "waiting_topic"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!data || data.length === 0) {
      await send(chatId, "ℹ️ No recent session found to correct.");
      return new Response("OK", { status: 200 });
    }

    const dispatch = data[0];
    const oldTopic = dispatch.notes_topic ?? "none";

    await sb.from("pending_dispatches")
      .update({ notes_topic: newTopic, status: "pending" })
      .eq("id", dispatch.id);

    const fireAt  = new Date(dispatch.scheduled_at);
    const diffMin = Math.max(0, Math.round((fireAt.getTime() - Date.now()) / 60000));

    await send(chatId,
      `✏️ <b>Topic corrected!</b>\n\n` +
      `Session: <b>${dispatch.session_name}</b>\n` +
      `Old topic: <s>${oldTopic}</s>\n` +
      `New topic: <b>${newTopic}</b>\n\n` +
      `⏰ Email fires in ~${diffMin} min with <b>${newTopic}</b> notes.`
    );
    return new Response("OK", { status: 200 });
  }

  // ── /help ─────────────────────────────────────────────────────────────────
  if (text === "/help") {
    await send(chatId,
      `🤖 <b>MOM Session Bot Commands</b>\n\n` +
      `Just type the topic name to save it\n` +
      `e.g. <code>Fair Value Gap</code>\n\n` +
      `/correct &lt;topic&gt; — fix a wrong topic\n` +
      `e.g. <code>/correct Market Structure</code>\n\n` +
      `/status — see all pending sessions\n` +
      `/help — show this message`
    );
    return new Response("OK", { status: 200 });
  }

  // ── Default: save topic for most recent waiting_topic dispatch ────────────
  const { data: waiting } = await sb
    .from("pending_dispatches")
    .select("*")
    .eq("status", "waiting_topic")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!waiting || waiting.length === 0) {
    // No waiting_topic — check if there's a pending one to correct
    const { data: pending } = await sb
      .from("pending_dispatches")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (pending && pending.length > 0) {
      // Update the topic on the pending dispatch
      await sb.from("pending_dispatches")
        .update({ notes_topic: text })
        .eq("id", pending[0].id);

      const fireAt  = new Date(pending[0].scheduled_at);
      const diffMin = Math.max(0, Math.round((fireAt.getTime() - Date.now()) / 60000));

      await send(chatId,
        `✏️ <b>Topic updated:</b> <b>${text}</b>\n\n` +
        `Session: ${pending[0].session_name}\n` +
        `⏰ Fires in ~${diffMin} min`
      );
    } else {
      await send(chatId,
        `ℹ️ No sessions waiting right now.\n\n` +
        `Use /status to see all pending sessions\n` +
        `Use /correct &lt;topic&gt; to fix a recent topic`
      );
    }
    return new Response("OK", { status: 200 });
  }

  const dispatch = waiting[0];

  await sb.from("pending_dispatches")
    .update({ notes_topic: text, status: "pending" })
    .eq("id", dispatch.id);

  const fireAt  = new Date(dispatch.scheduled_at);
  const diffMin = Math.max(0, Math.round((fireAt.getTime() - Date.now()) / 60000));
  const student = dispatch.session_name.split(" and ")[0].trim();

  await send(chatId,
    `✅ Got it! Topic saved: <b>${text}</b>\n\n` +
    `👤 ${student}\n` +
    `⏰ Email fires in ~${diffMin} min with the recording + <b>${text}</b> notes.\n\n` +
    `Made a typo? Use: <code>/correct ${text}</code>`
  );

  return new Response("OK", { status: 200 });
});
