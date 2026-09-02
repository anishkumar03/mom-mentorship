"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/quick-add", label: "+ Lead" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/leads", label: "Leads" },
  { href: "/applications", label: "Applications" },
  { href: "/journal", label: "Journal" },
  { href: "/prop-accounts", label: "Prop Accounts" },
  { href: "/students", label: "Students" },
  { href: "/notes", label: "Notes" },
  { href: "/batches", label: "Batches" },
  { href: "/email-batches", label: "Email Batches" },
  { href: "/archive", label: "Archive" },
  { href: "/roi-dashboard", label: "ROI" },
  { href: "/discipline", label: "Discipline" },
  { href: "/admin", label: "Admin" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <div className="nav" style={{
      display: "flex",
      gap: 4,
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      padding: "8px 12px",
      flexWrap: "wrap",
      maxWidth: "100%",
    }}>
      {links.map((l) => {
        const active = pathname?.startsWith(l.href);
        const isQuickAdd = l.href === "/quick-add";
        return (
          <Link
            key={l.href}
            href={l.href}
            style={isQuickAdd ? {
              color: "white",
              background: "var(--accent)",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textDecoration: "none",
              transition: "all 0.2s ease",
              border: "1px solid var(--accent)",
            } : {
              color: active ? "#ffffff" : "var(--muted)",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              paddingBottom: 6,
              paddingLeft: 8,
              paddingRight: 8,
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              whiteSpace: "nowrap",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
