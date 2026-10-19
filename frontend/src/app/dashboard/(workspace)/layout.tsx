"use client";

import { Suspense, useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { cn } from "@/lib/utils";

/**
 * Chrome for everything inside a module: sidebar, header, scrolling main.
 *
 * Previously this was the layout for all of /dashboard, which meant the
 * module hub rendered a sidebar listing the same modules the hub was
 * already listing.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <>
      <DashboardSidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isMobile={isMobile}
      />

      {/* Mobile Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 print:ml-0 print:block transition-[margin] duration-300 ease-in-out",
          sidebarOpen ? "md:ml-[240px]" : "md:ml-[70px]"
        )}
      >
        <div className="print:hidden">
          <Suspense fallback={<div className="h-14 border-b border-foreground/10 bg-background" />}>
            <DashboardHeader
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
            />
          </Suspense>
        </div>

        <main className="flex-1 p-3.5 sm:p-5 md:p-8 overflow-y-auto print:overflow-visible print:p-0 print:h-auto z-10">
          <div className="w-full space-y-6 print:max-w-none">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>
      </div>
    </>
  );
}
