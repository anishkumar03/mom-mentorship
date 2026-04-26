"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/quick-add", label: "+ Lead" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/leads", label: "Leads" },
  { href: "/applications", label: "Applications" },
  { href: "/journal", label: "Journal" },
  { href: "/students", label: "Students" },
  { href: "/confirmed", label: "Confirmed" },
  { href: "/batches", label: "Batches" },
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
    }}>
      {links.map((l) => {
        const active = pathname?.startsWith(l.href);
        const isQuickAdd = l.href === "/quick-add";
        const isApplications = l.href === "/applications";
        return (
          <Link
            key={l.href}
            href={l.href}
            style={isQuickAdd ? {
              color: "white",
              background: "var(--accent)",
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              textDecoration: "none",
            } : isApplications ? {
              color: active ? "white" : "#C9A84C",
              borderBottom: active ? "2px solid #C9A84C" : "2px solid rgba(201,168,76,0.3)",
              paddingBottom: 6,
              paddingLeft: 8,
              paddingRight: 8,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              whiteSpace: "nowrap",
              textDecoration: "none",
              transition: "color 0.15s, border-color 0.15s",
            } : {
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
