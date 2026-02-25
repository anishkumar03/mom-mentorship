"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/leads", label: "Leads" },
  { href: "/journal", label: "Journal" },
  { href: "/students", label: "Students" },
  { href: "/confirmed", label: "Confirmed" },
  { href: "/archive", label: "Archive" },
  { href: "/modules", label: "Modules" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <div className="nav">
      {links.map((l) => {
        const active = pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              color: active ? "var(--text)" : "var(--muted)",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              paddingBottom: 6,
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}


