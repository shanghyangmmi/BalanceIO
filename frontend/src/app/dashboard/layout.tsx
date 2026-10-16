"use client";

import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
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
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden selection:bg-emerald-100 dark:selection:bg-emerald-900/40">
      {/* Ambient Canvas Decor (Hidden on Print) */}
      <div className="fixed inset-0 z-0 pointer-events-none print:hidden overflow-hidden">
        {/* Subtle Dot Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.4] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] dark:opacity-[0.2]" />

        {/* Elegant Ambient Glows */}
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full animate-blob" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-teal-500/5 blur-[100px] rounded-full animate-blob animation-delay-2000" />
        <div className="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] bg-blue-500/5 blur-[120px] rounded-full animate-blob animation-delay-4000" />
      </div>

      {children}

      <Toaster />
      <OnboardingWizard />
      {/* Global ⌘K / Ctrl+K command palette */}
      <CommandPalette />
    </div>
  );
}
