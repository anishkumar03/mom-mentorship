import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;

  const body = await req.json();
  const { image } = body as { image?: string };

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid image format. Expected base64 data URL." },
      { status: 400 }
    );
  }

  const mediaType = match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  const base64Data = match[2];

  const prompt = `You are analyzing a prop firm trading account screenshot from firms like FTMO, TopStep, Apex, MyFundedFX, Lucid, etc.

Extract ALL visible account performance metrics and return them as a JSON object.

CRITICAL FOR LUCID & TOPSTEP: These firms show broker fees/charges separately. Extract both:
- "gross_pnl": The trading profit BEFORE broker fees (labeled as "Gross P&L" or just "P&L")
- "broker_fees": Any broker fees, commissions, or charges (labeled as "Total Charges", "Commissions", "Fees", etc.)
- "pnl": Calculate as (gross_pnl - broker_fees) for the net profit/loss

Return ONLY a valid JSON object with these fields (use null for any field not visible):

{
  "account_name": "string or null — the account name/ID/number if visible",
  "firm": "string or null — the prop firm name (e.g. FTMO, TopStep, Apex, MyFundedFX, Lucid, etc.)",
  "balance": number or null — current account balance or starting balance",
  "gross_pnl": number or null — trading profit BEFORE fees/commissions",
  "broker_fees": number or null — total broker fees, commissions, or charges",
  "pnl": number or null — NET profit/loss (gross_pnl minus broker_fees)",
  "drawdown": number or null — current drawdown percentage (as a number, e.g. 2.5 for 2.5%)",
  "max_drawdown": number or null — maximum drawdown percentage",
  "profit_factor": number or null — profit factor ratio",
  "win_rate": number or null — win rate percentage (as a number, e.g. 65 for 65%)",
  "total_trades": number or null — total number of trades",
  "winning_trades": number or null — number of winning trades",
  "losing_trades": number or null — number of losing trades",
  "avg_win": number or null — average winning trade amount",
  "avg_loss": number or null — average losing trade amount",
  "largest_win": number or null — largest single winning trade",
  "largest_loss": number or null — largest single losing trade",
  "status": "string or null — account status if visible (e.g. Active, Funded, Passed, Failed, Breached, Paper Trading, etc.)"
}

Important:
- Extract numbers WITHOUT currency symbols or commas
- For percentages, return the number only (65.5 not "65.5%")
- For negative values, use negative numbers
- ALWAYS look for broker fees/commissions/charges and extract separately
- pnl = gross_pnl - broker_fees (calculate if both are visible)
- If certain fields are not visible, use null (don't guess)
- Return ONLY the JSON object, no markdown, no explanation, no other text`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    if (workspaceId) {
      headers["anthropic-workspace-id"] = workspaceId;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return NextResponse.json(
        { error: "AI extraction failed" },
        { status: 502 }
      );
    }

    const result = await response.json();
    const text =
      result.content?.[0]?.text ?? "";

    console.log("AI Response:", text.slice(0, 500));

    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", text.slice(0, 1000));
      return NextResponse.json(
        { error: "Could not extract metrics from screenshot. Make sure the screenshot shows account performance data (balance, P&L, drawdown, etc.), not individual trade details." },
        { status: 422 }
      );
    }

    try {
      const extracted = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ data: extracted });
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid data extracted from screenshot. Please ensure the screenshot is clear and shows account performance metrics." },
        { status: 422 }
      );
    }
  } catch (err: unknown) {
    console.error("Extract screenshot error:", err);
    return NextResponse.json(
      { error: "Failed to process screenshot" },
      { status: 500 }
    );
  }
}
