import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Get emails sent in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const response = await queryResendAPI(`/emails?limit=100&created_at=${oneDayAgo}`);

    return NextResponse.json({
      totalEmails: response.data?.length || 0,
      oneDayAgoTime: oneDayAgo,
      emails: response.data?.slice(0, 5).map((e: any) => ({
        from: e.from,
        to: e.to,
        subject: e.subject,
        created_at: e.created_at,
      })) || [],
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
