/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !(serviceKey || anonKey)) {
  console.error("Missing SUPABASE URL or key. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey || anonKey || "");

const trades = [
  {
    symbol: "MNQU6",
    contracts: 2,
    entry_price: 29535.75,
    entry_time: "09/08/2026 09:57:52",
    exit_price: 29461.75,
    exit_time: "09/08/2026 10:02:00",
    pnl: -296.00,
  },
  {
    symbol: "MNQU6",
    contracts: 2,
    entry_price: 29496.25,
    entry_time: "09/08/2026 10:20:59",
    exit_price: 29551.00,
    exit_time: "09/08/2026 11:03:13",
    pnl: 219.00,
  },
  {
    symbol: "MNQU6",
    contracts: 1,
    entry_price: 29527.50,
    entry_time: "09/09/2026 10:28:59",
    exit_price: 29516.75,
    exit_time: "09/09/2026 10:18:00",
    pnl: -21.50,
  },
  {
    symbol: "MNQU6",
    contracts: 1,
    entry_price: 29527.50,
    entry_time: "09/09/2026 10:28:59",
    exit_price: 29535.00,
    exit_time: "09/09/2026 10:15:59",
    pnl: 30.00,
  },
  {
    symbol: "NQU6",
    contracts: 1,
    entry_price: 29483.75,
    entry_time: "09/09/2026 11:04:27",
    exit_price: 29486.25,
    exit_time: "09/09/2026 11:03:50",
    pnl: 50.00,
  },
  {
    symbol: "MNQU6",
    contracts: 3,
    entry_price: 29426.25,
    entry_time: "09/09/2026 11:11:02",
    exit_price: 29489.75,
    exit_time: "09/09/2026 11:04:35",
    pnl: 381.00,
  },
  {
    symbol: "MNQU6",
    contracts: 1,
    entry_price: 29191.00,
    entry_time: "09/10/2026 10:22:45",
    exit_price: 29118.75,
    exit_time: "09/10/2026 09:54:48",
    pnl: -144.50,
  },
  {
    symbol: "MNQU6",
    contracts: 2,
    entry_price: 29191.00,
    entry_time: "09/10/2026 10:22:45",
    exit_price: 29120.25,
    exit_time: "09/10/2026 09:53:05",
    pnl: -283.00,
  },
  {
    symbol: "MNQU6",
    contracts: 3,
    entry_price: 29168.00,
    entry_time: "09/10/2026 14:41:39",
    exit_price: 29214.75,
    exit_time: "09/10/2026 10:48:01",
    pnl: 280.50,
  },
  {
    symbol: "MNQU6",
    contracts: 3,
    entry_price: 29420.00,
    entry_time: "09/11/2026 09:35:00",
    exit_price: 29424.00,
    exit_time: "09/11/2026 09:46:50",
    pnl: 24.00,
  },
  {
    symbol: "MNQU6",
    contracts: 2,
    entry_price: 29439.75,
    entry_time: "09/11/2026 10:20:06",
    exit_price: 29368.75,
    exit_time: "09/11/2026 10:43:28",
    pnl: -426.00,
  },
  {
    symbol: "MNQU6",
    contracts: 1,
    entry_price: 28975.50,
    entry_time: "09/14/2026 10:42:16",
    exit_price: 29029.50,
    exit_time: "09/14/2026 10:21:12",
    pnl: 108.00,
  },
  {
    symbol: "MNQU6",
    contracts: 2,
    entry_price: 28975.50,
    entry_time: "09/14/2026 10:42:16",
    exit_price: 29031.75,
    exit_time: "09/14/2026 10:19:09",
    pnl: 225.00,
  },
  {
    symbol: "MNQZ6",
    contracts: 3,
    entry_price: 29292.75,
    entry_time: "09/15/2026 11:19:12",
    exit_price: 29270.25,
    exit_time: "09/15/2026 12:48:26",
    pnl: -135.00,
  },
];

async function addTrades() {
  console.log(`Adding ${trades.length} trades to journal...`);
  let added = 0;
  let failed = 0;

  for (const trade of trades) {
    const entryDate = new Date(trade.entry_time);
    const exitDate = new Date(trade.exit_time);

    const { data, error } = await supabase.from("trade_journal").insert({
      symbol: trade.symbol,
      contracts: trade.contracts,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      pnl: trade.pnl,
      entry_time: entryDate.toISOString(),
      exit_time: exitDate.toISOString(),
      trade_date: entryDate.toISOString().split("T")[0],
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`✗ Error adding trade ${trade.symbol}:`, error.message);
      failed += 1;
    } else {
      console.log(`✓ Added trade: ${trade.symbol} ${trade.contracts} contracts, P&L: $${trade.pnl}`);
      added += 1;
    }
  }

  console.log(`\nSummary: ${added} trades added, ${failed} failed.`);
  if (failed === 0) {
    console.log("All trades added successfully!");
  }
}

addTrades().catch((err) => {
  console.error("Failed to add trades:", err);
  process.exit(1);
});
