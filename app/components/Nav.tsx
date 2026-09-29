"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

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
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="nav" style={{
      display: "flex",
      gap: 4,
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      padding: "8px 12px",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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
                padding: "4px 12px",
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
                textDecoration: "none",
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
      <button
        onClick={handleLogout}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          fontSize: 13,
          cursor: "pointer",
          padding: "4px 8px",
          whiteSpace: "nowrap",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "white"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted)"}
      >
        Logout
      </button>
    </div>
  );
}
