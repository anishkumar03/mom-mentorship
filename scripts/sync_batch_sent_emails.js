/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const https = require("https");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE URL or SERVICE ROLE KEY. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!resendKey) {
  console.error("Missing RESEND_API_KEY environment variable.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function queryResendAPI(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.resend.com",
      path: path,
      method: "GET",
      headers: {
        Authorization: `Bearer ${resendKey}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function syncBatchSentEmails() {
  try {
    console.log("Fetching sent emails from Resend API...");

    // Get emails sent in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const response = await queryResendAPI(`/emails?limit=100&created_at=${oneDayAgo}`);

    if (!response.data) {
      console.log("No emails found in response");
      return;
    }

    const emails = response.data;
    console.log(`Found ${emails.length} emails sent in the last 24 hours`);

    let updated = 0;
    let skipped = 0;

    for (const email of emails) {
      // Only process emails sent from anish@mindovermarkets.net (batch emails)
      if (email.from !== "anish@mindovermarkets.net") {
        skipped++;
        continue;
      }

      if (!email.to || email.to.length === 0) {
        skipped++;
        continue;
      }

      const recipientEmail = Array.isArray(email.to) ? email.to[0] : email.to;

      // Check if this email was already marked as batch sent
      const { data: existing } = await supabase
        .from("leads")
        .select("id, batch_sent_at")
        .eq("email", recipientEmail)
        .single()
        .catch(() => ({ data: null }));

      if (!existing) {
        console.log(`ℹ Lead not found for email: ${recipientEmail}`);
        skipped++;
        continue;
      }

      if (existing.batch_sent_at) {
        console.log(`⊘ Already marked: ${recipientEmail}`);
        skipped++;
        continue;
      }

      // Update the lead with batch_sent_at timestamp
      const { error } = await supabase
        .from("leads")
        .update({ batch_sent_at: new Date(email.created_at).toISOString() })
        .eq("email", recipientEmail);

      if (error) {
        console.error(`✗ Error updating ${recipientEmail}:`, error.message);
        skipped++;
      } else {
        console.log(`✓ Marked as batch sent: ${recipientEmail}`);
        updated++;
      }
    }

    console.log(`\nSummary: ${updated} leads updated, ${skipped} skipped`);
  } catch (error) {
    console.error("Failed to sync batch sent emails:", error);
    process.exit(1);
  }
}

syncBatchSentEmails();
