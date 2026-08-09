# Mind Over Markets Discord Bot

Welcomes new members with a scam-warning DM. If their DMs are closed (the common
case), it falls back to a mention in the welcome channel instead. Every join and
leave is logged to Supabase either way.

## 1. Discord Developer Portal setup

1. Go to https://discord.com/developers/applications and click **New Application**.
   Name it whatever you like (e.g. "Mind Over Markets").
2. In the sidebar, go to **Bot**. Click **Reset Token** (or **Add Bot** if this is a
   fresh app) and copy the token — this is your `DISCORD_TOKEN`. Keep it secret; it
   grants full control of the bot account.
3. On the same **Bot** page, scroll to **Privileged Gateway Intents** and enable
   **Server Members Intent**. This is required — without it, Discord will silently
   never send the bot `GuildMemberAdd`/`GuildMemberRemove` events, and the bot will
   otherwise appear to run fine while doing nothing.
4. Go to **OAuth2 → URL Generator**. Under **Scopes**, check `bot`. Under
   **Bot Permissions**, check:
   - **View Channels**
   - **Send Messages**

   That's all this bot needs — it doesn't require Manage Roles, Manage Server, or
   anything else. Copy the generated URL, open it in a browser, and invite the bot
   to your server.

## 2. Getting the IDs you need

You need `GUILD_ID`, `WELCOME_CHANNEL_ID`, `RULES_CHANNEL_ID`, and
`GENERAL_CHANNEL_ID`. To copy any of these:

1. In Discord, go to **User Settings → Advanced** and turn on **Developer Mode**.
2. To get the **server ID**: right-click the server's icon in the left sidebar →
   **Copy Server ID**. That's `GUILD_ID`.
3. To get a **channel ID**: right-click the channel in the channel list → **Copy
   Channel ID**. Do this for your welcome channel, your rules channel, and your
   general channel.

## 3. Configure

```bash
cd discord-bot
cp .env.example .env
```

Fill in `.env` with the token and IDs from steps 1–2, plus your Supabase project's
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project
Settings → API). The service role key is required, not the anon key — the bot
writes to `discord_members` from a trusted server process with no user session.

## 4. Database

Run the migration in `../supabase/migrations/20260809_create_discord_members.sql`
against your Supabase project (SQL Editor, or your usual migration flow — it's not
run automatically by anything in this repo). It creates the `discord_members` table:

| column            | type        | notes                                   |
|-------------------|-------------|------------------------------------------|
| id                | uuid        | primary key                             |
| discord_user_id   | text        | unique — upserted on rejoin             |
| discord_username  | text        |                                          |
| joined_at         | timestamptz |                                          |
| dm_delivered      | boolean     | true if the scam-warning DM landed      |
| left_at           | timestamptz | null until the member leaves            |

## 5. Install and run

```bash
npm install
npm start
```

You should see `Logged in as <bot>#0000. Watching guild <id>.` in the console. Have
someone join the server (or leave and rejoin) to test — the console logs every
join/leave attempt, whether the DM landed, and any Supabase write failures, so you
can debug from the host's logs without touching Discord.

## 6. Hosting

This bot needs to stay connected to Discord's gateway (a persistent WebSocket) at
all times to receive `GuildMemberAdd` events — **Vercel and Supabase Edge Functions
will not work**, because both only run your code per-request and shut it down
afterward; there's no long-lived process to hold the gateway connection open, so
the bot would never actually receive join events.

Options that do work, since they run a normal always-on Node process:

- **Railway** or **Render** (background worker / "Background Service" type,
  not a web service) — simplest, has a free/cheap tier, deploy straight from this
  `discord-bot/` folder.
- **Fly.io** — similar, slightly more setup, generous free allowance.
- A small **VPS** (e.g. a $5/mo droplet) running the bot under `pm2` or a
  `systemd` service so it restarts on crash/reboot.

Whichever you pick, set the same environment variables from `.env.example` in the
host's config rather than committing `.env`.
