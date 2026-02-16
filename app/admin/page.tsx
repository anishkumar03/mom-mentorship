"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Student = {
  id: string;
  name: string;
  email: string;
  cohort: string | null;
  payment_status: string | null;
};

export default function AdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [status, setStatus] = useState("Checking login...");

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? "";

      if (!email) {
        window.location.href = "/login";
        return;
      }

      if (email !== "anish@mindovermarkets.net") {
        setStatus("Access denied.");
        return;
      }

      const { data: rows, error } = await supabase
        .from("students")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStudents(rows ?? []);
      setStatus("Ready");
    };

    run();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Admin Dashboard</h2>
      <p>{status}</p>

      <table style={{ width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Cohort</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.email}</td>
              <td>{s.cohort}</td>
              <td>{s.payment_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
