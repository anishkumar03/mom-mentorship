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
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id,total_fee,created_at")
    .eq("paid_in_full", true);

  if (studentsError) {
    console.error("Failed to load students:", studentsError.message);
    process.exit(1);
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id,student_id,amount");

  if (paymentsError) {
    console.error("Failed to load payments:", paymentsError.message);
    process.exit(1);
  }

  const paidMap = new Map();
  for (const p of payments || []) {
    if (!p.student_id) continue;
    if (!paidMap.has(p.student_id)) paidMap.set(p.student_id, new Set());
    const amount = typeof p.amount === "number" ? p.amount : Number(p.amount);
    if (Number.isFinite(amount)) paidMap.get(p.student_id).add(amount);
  }

  let inserted = 0;
  for (const s of students || []) {
    const totalFee = typeof s.total_fee === "number" ? s.total_fee : Number(s.total_fee);
    if (!Number.isFinite(totalFee) || totalFee <= 0) continue;

    const amounts = paidMap.get(s.id) || new Set();
    if (amounts.has(totalFee)) continue;

    const paymentDate = s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString();
    const { error } = await supabase
      .from("payments")
      .insert({ student_id: s.id, amount: totalFee, payment_date: paymentDate });
    if (error) {
      console.error(`Failed to insert payment for student ${s.id}:`, error.message);
      continue;
    }
    inserted += 1;
  }

  console.log(`Backfill complete. Inserted ${inserted} payment rows.`);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
