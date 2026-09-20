import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function queryResendAPI(path: string): Promise<any> {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Resend API error: ${res.statusText}`);
  }

  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Fetch emails from last 24 hours
    const response = await queryResendAPI(`/emails?limit=100`);

    if (!response.data || response.data.length === 0) {
      return NextResponse.json({
        updated: 0,
        skipped: 0,
        message: "No emails found",
      });
    }

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const emails = response.data;
    let updated = 0;
    let skipped = 0;
    let emailsChecked = 0;

    for (const email of emails) {
      // Only process emails from batch sender
      if (!email.from || email.from !== "anish@mindovermarkets.net") {
        skipped++;
        continue;
      }

      // Check if email is from last 24 hours
      const emailTime = new Date(email.created_at).getTime();
      if (emailTime < oneDayAgo) {
        skipped++;
        continue;
      }

      if (!email.to || email.to.length === 0) {
        skipped++;
        continue;
      }

      emailsChecked++;
      const recipientEmail = Array.isArray(email.to) ? email.to[0] : email.to;

      // Check if lead exists and doesn't already have batch_sent_at
      let existing;
      try {
        const { data, error } = await supabase
          .from("leads")
          .select("id, batch_sent_at")
          .eq("email", recipientEmail.toLowerCase())
          .single();

        if (error || !data) {
          skipped++;
          continue;
        }
        existing = data;
      } catch (err) {
        skipped++;
        continue;
      }

      if (existing.batch_sent_at) {
        skipped++;
        continue;
      }

      // Update with batch_sent_at
      try {
        const { error: updateError } = await supabase
          .from("leads")
          .update({ batch_sent_at: new Date(email.created_at).toISOString() })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Update error:", updateError);
          skipped++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error("Update exception:", err);
        skipped++;
      }
    }

    return NextResponse.json({
      updated,
      skipped,
      message: `Updated ${updated} leads, skipped ${skipped}`,
    });
  } catch (error) {
    console.error("Sync batch sent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
