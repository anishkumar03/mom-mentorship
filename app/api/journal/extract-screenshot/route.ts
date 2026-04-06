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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured. Screenshot extraction is unavailable." },
      { status: 503 }
    );
  }

  try {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "trade_screenshot_extract",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                trades: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      symbol: { type: ["string", "null"] },
                      direction: { type: ["string", "null"] },
                      entry_time: { type: ["string", "null"] },
                      exit_time: { type: ["string", "null"] },
                      entry_price: { type: ["number", "null"] },
                      exit_price: { type: ["number", "null"] },
                      pnl: { type: ["number", "null"] },
                      contracts: { type: ["number", "null"] },
                      commissions: { type: ["number", "null"] },
                      fees: { type: ["number", "null"] }
                    },
                    required: [
                      "symbol",
                      "direction",
                      "entry_time",
                      "exit_time",
                      "entry_price",
                      "exit_price",
                      "pnl",
                      "contracts",
                      "commissions",
                      "fees"
                    ]
                  }
                }
              },
              required: ["trades"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Extract every visible trade row from the screenshot. Table-style screenshots may contain multiple rows, and each visible row must become a separate trade object in order from top to bottom. Only return values that are clearly visible for each row. Use null when a field is missing or uncertain. Normalize direction to Long or Short. Normalize times to 24-hour HH:MM with no timezone conversion. Return numbers only for prices, pnl, contracts, commissions, and fees. Ignore setup, emotion, and notes.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Read the screenshot and return all visible trade rows as a trades array. For each row, extract symbol, direction, entry_time, exit_time, entry_price, exit_price, pnl, contracts, commissions, and fees. If only one trade row is visible, still return a trades array with one item.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || "Screenshot extraction failed.";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const content = extractJsonText(payload);
    if (!content) {
      return NextResponse.json({ error: "No extraction result returned." }, { status: 502 });
    }

    const parsed = JSON.parse(content);
    const rawTrades = Array.isArray(parsed?.trades) ? parsed.trades : [];
    const trades = rawTrades
      .map((trade) => normalizePayload(trade))
      .filter((trade) =>
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
