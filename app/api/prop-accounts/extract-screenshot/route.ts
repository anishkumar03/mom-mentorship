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

  const prompt = `You are analyzing a prop firm trading account performance screenshot. Extract ALL visible metrics and return them as a JSON object.

Return ONLY a valid JSON object with these fields (use null for any field not visible):

{
  "account_name": "string or null — the account name/ID/number if visible",
  "firm": "string or null — the prop firm name (e.g. FTMO, TopStep, Apex, MyFundedFX, etc.)",
  "balance": number or null — current account balance,
  "pnl": number or null — total profit/loss (net P&L),
  "drawdown": number or null — current drawdown percentage (as a number, e.g. 2.5 for 2.5%),
  "max_drawdown": number or null — maximum drawdown percentage,
  "profit_factor": number or null — profit factor ratio,
  "win_rate": number or null — win rate percentage (as a number, e.g. 65 for 65%),
  "total_trades": number or null — total number of trades,
  "winning_trades": number or null — number of winning trades,
  "losing_trades": number or null — number of losing trades,
  "avg_win": number or null — average winning trade amount,
  "avg_loss": number or null — average losing trade amount,
  "largest_win": number or null — largest single winning trade,
  "largest_loss": number or null — largest single losing trade,
  "status": "string or null — account status if visible (e.g. Active, Funded, Passed, Failed, Breached)"
}

Important:
- Extract numbers WITHOUT currency symbols or commas
- For percentages, return the number only (65.5 not "65.5%")
- For negative P&L or drawdown, use negative numbers
- If the screenshot shows a dashboard with multiple metrics, extract all you can find
- Return ONLY the JSON object, no markdown, no explanation`;

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
        model: "claude-sonnet-4-20250514",
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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse AI response", raw: text },
        { status: 422 }
      );
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ data: extracted });
  } catch (err: unknown) {
    console.error("Extract screenshot error:", err);
    return NextResponse.json(
      { error: "Failed to process screenshot" },
      { status: 500 }
    );
  }
}
