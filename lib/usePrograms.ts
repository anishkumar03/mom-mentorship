"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fallback programs in case the table doesn't exist yet
const FALLBACK = ["April Group Mentorship", "Private Coaching"];

export function usePrograms() {
  const [programs, setPrograms] = useState<string[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const fetchPrograms = async () => {
    const { data, error } = await supabase
      .from("programs")
      .select("name")
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      setPrograms(data.map((p: { name: string }) => p.name));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  return { programs, loading, refetch: fetchPrograms };
}
