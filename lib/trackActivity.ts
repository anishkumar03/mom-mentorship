import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function trackActivity(
  userId: string,
  module: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userEmail = data.user?.email ?? null;
    await supabase.from("activity_logs").insert({
      user_id: userId,
      user_email: userEmail,
      module,
      action,
      metadata,
    });
  } catch {
    // Silent fail — never disrupt the user experience
  }
}
