require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const {
  DISCORD_TOKEN,
  GUILD_ID,
  WELCOME_CHANNEL_ID,
  RULES_CHANNEL_ID,
  GENERAL_CHANNEL_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const requiredEnv = {
  DISCORD_TOKEN,
  GUILD_ID,
  WELCOME_CHANNEL_ID,
  RULES_CHANNEL_ID,
  GENERAL_CHANNEL_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
};
for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

function buildDmText(username) {
  return `Hi ${username},
Glad to have you here.

We have noticed scammers targeting new members of this community. Here is what you need to know:

Scammers are creating fake Discord accounts impersonating me using names like "Anish", "Anish MOM" or "Mind Over Markets". They will DM you pretending to be me.

They are directing people to deposit money with fake brokers such as "Optimals Markets" and similar platforms. These are scams designed to steal your money.

I will never DM you first asking you to deposit money, sign up with a broker, or send funds anywhere. All official communication about mentorship happens through this server or my verified social media accounts.

How to protect yourself:
- Do not respond to unsolicited DMs from anyone claiming to be me or part of my team
- Do not deposit money into any platform someone recommends through DMs
- Verify any account claiming to be me by checking my role in this server before engaging
- If you receive a suspicious DM, take a screenshot and report it in <#${GENERAL_CHANNEL_ID}> immediately

If you are ever unsure whether a message is genuinely from me, ask in the server. It takes ten seconds to verify and could save you thousands of dollars.

Stay safe and welcome aboard.

Mind Over Markets`;
}

function buildFallbackText(userId) {
  return `Welcome <@${userId}> — please read <#${RULES_CHANNEL_ID}> before posting.`;
}

async function logMemberJoin(member, dmDelivered) {
  try {
    const { error } = await supabase.from("discord_members").upsert(
      {
        discord_user_id: member.id,
        discord_username: member.user.username,
        joined_at: new Date().toISOString(),
        dm_delivered: dmDelivered,
        left_at: null,
      },
      { onConflict: "discord_user_id" }
    );
    if (error) {
      console.error(`[Supabase] Failed to log join for ${member.user.username} (${member.id}):`, error.message);
    }
  } catch (err) {
    console.error(`[Supabase] Unexpected error logging join for ${member.user.username} (${member.id}):`, err);
  }
}

async function logMemberLeave(member) {
  const userId = member.id;
  const username = member.user?.username ?? "unknown";
  try {
    const { error } = await supabase
      .from("discord_members")
      .update({ left_at: new Date().toISOString() })
      .eq("discord_user_id", userId);
    if (error) {
      console.error(`[Supabase] Failed to log leave for ${username} (${userId}):`, error.message);
    }
  } catch (err) {
    console.error(`[Supabase] Unexpected error logging leave for ${username} (${userId}):`, err);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}. Watching guild ${GUILD_ID}.`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  const username = member.displayName;
  let dmDelivered = false;

  try {
    await member.send(buildDmText(username));
    dmDelivered = true;
    console.log(`[DM] Delivered welcome DM to ${username} (${member.id})`);
  } catch (err) {
    console.warn(`[DM] Could not DM ${username} (${member.id}): ${err.message}. Falling back to the welcome channel.`);
    try {
      const welcomeChannel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
      if (welcomeChannel && welcomeChannel.isTextBased()) {
        await welcomeChannel.send(buildFallbackText(member.id));
        console.log(`[Fallback] Posted welcome message in the welcome channel for ${username} (${member.id})`);
      } else {
        console.error(`[Fallback] WELCOME_CHANNEL_ID ${WELCOME_CHANNEL_ID} is not a text channel`);
      }
    } catch (fallbackErr) {
      console.error(`[Fallback] Failed to post fallback welcome message for ${username} (${member.id}):`, fallbackErr);
    }
  }

  await logMemberJoin(member, dmDelivered);
});

client.on(Events.GuildMemberRemove, async (member) => {
  if (member.guild.id !== GUILD_ID) return;
  console.log(`[Leave] ${member.user?.username ?? member.id} (${member.id}) left the guild`);
  await logMemberLeave(member);
});

client.login(DISCORD_TOKEN);
