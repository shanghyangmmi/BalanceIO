"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermission } from "@/contexts/permission-context";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  adminOnly?: boolean;
}

const sidebarNavItems: NavItem[] = [
  {
    title: "Company Profile",
    href: "/dashboard/settings",
  },
  {
    title: "User Management",
    href: "/dashboard/settings/users",
    adminOnly: true, // Finance & Auditor cannot access
  },
  {
    title: "Exchange Rates",
    href: "/dashboard/settings/exchange-rates",
  },
  {
    title: "Subscription",
    href: "/dashboard/settings/subscription",
    adminOnly: true, // Finance & Auditor cannot access
  },
  {
    title: "Security",
    href: "/dashboard/settings/security",
  },
  {
    title: "Migration & Import",
    href: "/dashboard/settings/migration",
  },
  {
    title: "Audit Logs",
    href: "/dashboard/settings/audit-logs",
  },
  {
    title: "Data Backup",
    href: "/dashboard/settings/backup",
  },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const { isAdmin } = usePermission();

  const filteredNavItems = useMemo(() => {
    return sidebarNavItems.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      return true;
    });
  }, [isAdmin]);

  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-0.5">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
          Settings
        </h2>
      </div>

      {/* Horizontal Tabs */}
      <nav className="flex gap-2 border-b pb-2 overflow-x-auto">
        {filteredNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
              pathname === item.href
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {item.title}
          </Link>
        ))}
      </nav>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
