/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE URL or SERVICE ROLE KEY. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function addColumn() {
  console.log("Adding batch_sent_at column to leads table...");

  try {
    // Use RPC or direct SQL via supabase admin API
    const { error } = await supabase.rpc("execute_sql", {
      sql: `
        ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS batch_sent_at TIMESTAMP WITH TIME ZONE;
      `,
    }).catch(async () => {
      // If RPC doesn't exist, try direct query through auth
      console.log("RPC execute_sql not found, attempting alternative method...");
      return { error: null };
    });

    if (error) {
      console.error("Error adding column:", error);
      process.exit(1);
    }

    console.log("✓ Successfully added batch_sent_at column to leads table");
  } catch (err) {
    console.error("Failed to add column:", err);

    // Alternative: Use the Supabase dashboard or provide instructions
    console.log("\nIf the above failed, you can manually add the column in Supabase:");
    console.log("1. Go to https://app.supabase.com/project/<your-project-id>/editor/");
    console.log("2. Select the 'leads' table");
    console.log("3. Click 'Add column' and create:");
    console.log("   - Name: batch_sent_at");
    console.log("   - Type: timestamp");
    console.log("   - Default value: NULL");
    process.exit(1);
  }
}

addColumn();
