/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

type ExtractedTrade = {
  symbol: string | null;
  direction: "Long" | "Short" | null;
  entry_time: string | null;
  exit_time: string | null;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  contracts: number | null;
  commissions: number | null;
  fees: number | null;
};

function extractJsonText(payload: any) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((item: any) => item?.type === "text" && typeof item?.text === "string");
    if (textPart?.text) return textPart.text;
  }
  return "";
}

function normalizeTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDirection(value: unknown): "Long" | "Short" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["long", "buy"].includes(normalized)) return "Long";
  if (["short", "sell"].includes(normalized)) return "Short";
  return null;
}

function normalizeSymbol(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  return normalized || null;
}

function getPointValue(symbol: string | null): number {
  if (!symbol) return 1;
  const sym = symbol.toUpperCase();
  const pointValues: Record<string, number> = {
    ES: 50,
    MES: 5,
    NQ: 20,
    MNQ: 2,
    YM: 5,
    MYM: 0.5,
    GC: 100,
    CL: 1000,
    NG: 10000,
  };
  return pointValues[sym] || 1;
}

function normalizePayload(value: any): ExtractedTrade {
  const symbol = normalizeSymbol(value?.symbol);
  const entryPrice = normalizeNumber(value?.entry_price);
  const exitPrice = normalizeNumber(value?.exit_price);
  const contracts = normalizeNumber(value?.contracts);
  const direction = normalizeDirection(value?.direction);

  let pnl = normalizeNumber(value?.pnl);

  if (pnl === null && entryPrice !== null && exitPrice !== null && contracts !== null) {
    const pointValue = getPointValue(symbol);
    const priceDiff = entryPrice - exitPrice;
    const directionMultiplier = direction === "Short" ? 1 : -1;
    pnl = priceDiff * pointValue * contracts * directionMultiplier;
  }

  return {
    symbol,
    direction,
    entry_time: normalizeTime(value?.entry_time),
    exit_time: normalizeTime(value?.exit_time),
    entry_price: entryPrice,
    exit_price: exitPrice,
    pnl,
    contracts,
    commissions: normalizeNumber(value?.commissions),
    fees: normalizeNumber(value?.fees),
  };
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only png, jpg, and jpeg files are supported." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Screenshot extraction is unavailable." },
      { status: 503 }
    );
  }

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;

  try {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `CRITICAL: You must return ONLY a JSON object. No text before or after. No markdown. Just raw JSON.

Extract trading orders from this screenshot and group them into complete trades (entry + exit).

IMPORTANT: A single trade may involve multiple orders:
- SHORT trade: First SELL order is entry, first FILLED BUY order is exit
- LONG trade: First BUY order is entry, first FILLED SELL order is exit
- Ignore CANCELLED orders - only use FILLED orders
- Use the FILLED prices, not Limit/Stop prices
- Group by symbol and contracts to identify complete round-trip trades

For each complete trade, extract:
- symbol: trading symbol (e.g., ES, NQ, MNQ, SPY)
- direction: "Long" or "Short" (based on which side is entry)
- entry_time: time of entry order as HH:MM in 24-hour format
- exit_time: time of exit order as HH:MM in 24-hour format
- entry_price: price where position was opened (filled price)
- exit_price: price where position was closed (filled price)
- pnl: profit/loss as number (negative for losses)
  * For SHORT: pnl = (entry_price - exit_price) × contracts
  * For LONG: pnl = (exit_price - entry_price) × contracts
- contracts: number of contracts (as integer)
- commissions: total commissions for the trade (sum if multiple orders)
- fees: total fees for the trade (sum if multiple orders)

Rules:
- If a trade shows explicit P&L on screen, use that value
- Calculate P&L from prices if not shown
- Only include FILLED orders in your calculations
- Ignore pending/cancelled orders
- Return null for fields not visible

START RESPONSE WITH { AND END WITH }. NO OTHER TEXT.

{
  "trades": [
    {
      "symbol": "MNQ",
      "direction": "Short",
      "entry_time": "10:52",
      "exit_time": "10:53",
      "entry_price": 29232.25,
      "exit_price": 29193.75,
      "pnl": 308.00,
      "contracts": 4,
      "commissions": null,
      "fees": null
    }
  ]
}`;

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
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                  data: base64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `Screenshot extraction failed: ${response.status} - ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const content = payload.content?.[0]?.text ?? "";

    console.log("AI Response:", content.slice(0, 1000));

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response:", content.slice(0, 1000));
        return NextResponse.json({ error: `Could not parse AI response: ${content.slice(0, 300)}` }, { status: 422 });
      }

      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("JSON parse error:", jsonMatch[0].slice(0, 500));
        return NextResponse.json({ error: `Invalid JSON: ${String(parseError).slice(0, 200)}` }, { status: 422 });
      }
    }
    const rawTrades = Array.isArray(parsed?.trades) ? parsed.trades : [];
    const trades = rawTrades
      .map((trade: Record<string, unknown>) => normalizePayload(trade))
      .filter((trade: Record<string, unknown>) =>
        Object.values(trade).some((value) => value !== null)
      );

    return NextResponse.json({ trades }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Screenshot extraction failed." },
      { status: 500 }
    );
  }
}
