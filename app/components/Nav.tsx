"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
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
    <div className="nav" style={{
      display: "flex",
      gap: 4,
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      padding: "8px 12px",
    }}>
      {links.map((l) => {
        const active = pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              color: active ? "white" : "var(--muted)",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              paddingBottom: 6,
              paddingLeft: 8,
              paddingRight: 8,
              fontSize: 13,
              fontWeight: active ? 700 : 400,
              whiteSpace: "nowrap",
              textDecoration: "none",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
