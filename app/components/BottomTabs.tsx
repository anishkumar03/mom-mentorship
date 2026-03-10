"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/quick-add", label: "+ Lead" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/roi-dashboard", label: "ROI" },
  { href: "/leads", label: "Leads" },
  { href: "/journal", label: "Journal" },
  { href: "/students", label: "Students" },
  { href: "/confirmed", label: "Confirmed" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/admin", label: "Admin" },
];

export default function BottomTabs() {
  const pathname = usePathname();

  // hide on login page
  if (pathname === "/login") return null;

  return (
    <div className="mom-bottom-tabs">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={"mom-tab " + (active ? "mom-tab-active" : "")}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

