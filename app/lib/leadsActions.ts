import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function archiveLead(id: string) {
  return supabase.from("leads").update({ archived_at: new Date().toISOString() }).eq("id", id);
}

export async function unarchiveLead(id: string) {
  return supabase.from("leads").update({ archived_at: null }).eq("id", id);
}

export async function deleteLead(id: string) {
  return supabase.from("leads").delete().eq("id", id);
}
