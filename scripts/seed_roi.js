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

async function run() {
  const { data: firms, error: firmsError } = await supabase.from("prop_firms").select("id,name");
  if (firmsError) {
    console.error("Failed to load firms:", firmsError.message);
    process.exit(1);
  }

  if ((firms || []).length === 0) {
    const { error } = await supabase.from("prop_firms").insert([
      { name: "Apex Trader", platform: "Apex", account_size: 50000, profit_split: 90 },
      { name: "Topstep", platform: "Topstep", account_size: 100000, profit_split: 80 },
      { name: "Funding Pips", platform: "FundingPips", account_size: 50000, profit_split: 85 }
    ]);
    if (error) {
      console.error("Failed to seed firms:", error.message);
      process.exit(1);
    }
  }

  const { data: firmsAfter } = await supabase.from("prop_firms").select("id,name");
  const firmMap = new Map((firmsAfter || []).map((f) => [f.name, f.id]));

  const { data: entries, error: entriesError } = await supabase.from("roi_entries").select("id");
  if (entriesError) {
    console.error("Failed to load entries:", entriesError.message);
    process.exit(1);
  }

  if ((entries || []).length === 0) {
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const sample = [
      {
        firm_id: firmMap.get("Apex Trader"),
        entry_date: `${month}-03`,
        entry_type: "expense",
        amount: 150,
        category: "Platform",
        description: "Activation fee",
        notes: "New account"
      },
      {
        firm_id: firmMap.get("Apex Trader"),
        entry_date: `${month}-10`,
        entry_type: "payout",
        amount: 1200,
        category: "Payout",
        description: "First payout",
        notes: ""
      },
      {
        firm_id: firmMap.get("Topstep"),
        entry_date: `${month}-07`,
        entry_type: "expense",
        amount: 250,
        category: "Reset",
        description: "Reset fee",
        notes: ""
      },
      {
        firm_id: firmMap.get("Funding Pips"),
        entry_date: `${month}-12`,
        entry_type: "payout",
        amount: 600,
        category: "Payout",
        description: "Monthly payout",
        notes: ""
      }
    ].filter((e) => e.firm_id);

    const { error } = await supabase.from("roi_entries").insert(sample);
    if (error) {
      console.error("Failed to seed entries:", error.message);
      process.exit(1);
    }
  }

  console.log("ROI seed complete.");
}

run().catch((err) => {
  console.error("ROI seed failed:", err);
  process.exit(1);
});
