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

function normalizePayload(value: any): ExtractedTrade {
  return {
    symbol: normalizeSymbol(value?.symbol),
    direction: normalizeDirection(value?.direction),
    entry_time: normalizeTime(value?.entry_time),
    exit_time: normalizeTime(value?.exit_time),
    entry_price: normalizeNumber(value?.entry_price),
    exit_price: normalizeNumber(value?.exit_price),
    pnl: normalizeNumber(value?.pnl),
    contracts: normalizeNumber(value?.contracts),
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

  try {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `Extract every visible trade row from this screenshot. Return a JSON object with a "trades" array.

For each visible trade row (in order from top to bottom), extract these fields:
- symbol: trading symbol (e.g., ES, NQ, SPY)
- direction: "Long" or "Short"
- entry_time: time as HH:MM in 24-hour format
- exit_time: time as HH:MM in 24-hour format
- entry_price: entry price as number
- exit_price: exit price as number
- pnl: profit/loss as number (can be negative)
- contracts: number of contracts as integer
- commissions: commission amount as number
- fees: fees as number

Use null for any field not clearly visible. Return ONLY valid JSON, no markdown or explanation.

Example format:
{
  "trades": [
    {
      "symbol": "ES",
      "direction": "Long",
      "entry_time": "09:30",
      "exit_time": "10:15",
      "entry_price": 4500.25,
      "exit_price": 4510.75,
      "pnl": 105.00,
      "contracts": 1,
      "commissions": 2.50,
      "fees": null
    }
  ]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
      console.error("Anthropic API error:", errText);
      return NextResponse.json(
        { error: "Screenshot extraction failed" },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const content = payload.content?.[0]?.text ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
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
