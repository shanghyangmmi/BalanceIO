"use client";

import { HubNavbar } from "@/components/dashboard/hub-navbar";

/**
 * The module hub: a navbar and the doors. Nothing else.
 *
 * No sidebar on purpose. The sidebar exists to move around inside a
 * module; on the page whose entire job is choosing a module it would list
 * the same things the page already lists, in worse type, and give the
 * reader two places to click for the same destination.
 */
export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <HubNavbar />

      <main className="z-10 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          {children}
        </div>
      </main>
    </div>
  );
}
