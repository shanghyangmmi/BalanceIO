"use client";

import { useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { CommandPalette } from "@/components/command-palette";

/**
 * The shell every signed-in screen shares: the auth gate, the ambient
 * ground, and the global bits that must exist exactly once.
 *
 * The chrome lives one level down, in two route groups:
 *
 *   (hub)        the module hub - a navbar and the list of doors. No
 *                sidebar, deliberately: it is the page you pick a module
 *                from, and a sidebar listing every module on the page
 *                whose whole job is listing every module is the same
 *                screen drawn twice.
 *   (workspace)  everything inside a module - sidebar, header, breadcrumb.
 *
 * Route groups do not appear in the URL, so the hub is still /dashboard.
 * Putting the split in the folder structure rather than a `pathname ===
 * "/dashboard"` check means it cannot be undone by accident.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useKeyboardShortcuts();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
    }
  }, []);

  return (
    <div className="flex h-screen bg-background relative overflow-hidden selection:bg-emerald-500/20 print:block print:h-auto print:overflow-visible print:bg-white">
      {/* Static and quiet on purpose: people read figures here for hours.
          No animated glows behind the ledger. */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none print:hidden bg-[radial-gradient(rgba(120,130,140,0.18)_1px,transparent_1px)] [background-size:32px_32px] opacity-50 dark:opacity-25"
      />

      {children}

      <OnboardingWizard />
      {/* Global ⌘K / Ctrl+K command palette */}
      <CommandPalette />
    </div>
  );
}
