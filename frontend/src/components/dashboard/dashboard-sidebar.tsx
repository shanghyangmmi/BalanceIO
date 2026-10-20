import Link from "next/link"
import React, { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
    LayoutDashboard,
    PieChart,
    Wallet,
    TrendingUp,
    ShoppingBag,
    CreditCard,
    Box,
    FileSpreadsheet,
    FileText,
    Users,
    Settings,
    MoreHorizontal,
    LogOut,
    ChevronLeft,
    Calculator,
    Activity,
    ChevronDown,
    PlusCircle,
    Check,
    Folder,
    ShieldCheck,
    BookOpenCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCompany } from "@/contexts/company-context"
import { useLanguage } from "@/contexts/language-context"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePermissionCheck } from "@/hooks/use-permissions"
import { activeHref, resolveModule } from "@/lib/module-nav"

interface SidebarProps {
    isOpen: boolean
    setIsOpen: (value: boolean) => void
    isMobile?: boolean
    closeMobile?: () => void
}

export function DashboardSidebar({ isOpen, setIsOpen, isMobile, closeMobile }: SidebarProps) {
    const pathname = usePathname()
    const { company, companies, setCompany } = useCompany()
    const { t } = useLanguage()
    const { can } = usePermissionCheck()

    // Only this module's menu. Walking into Accounting should read as a
    // different application, not as one app with the other three parked in
    // the rail; the way back out is the hub button in the navbar.
    const currentModule = resolveModule(pathname)
    const current = currentModule ? activeHref(currentModule, pathname) : null

    // Fix hydration mismatch for Radix UI (random IDs)
    const [mounted, setMounted] = React.useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <>
                <aside
                    className={cn(
                        "fixed top-0 left-0 z-40 h-screen print:hidden bg-background border-r border-foreground/10 transition-all duration-300 w-[240px]",
                        !isOpen && "-translate-x-full md:translate-x-0 md:w-[70px]",
                        isMobile && "shadow-2xl"
                    )}
                >
                    <div className="h-14 flex items-center justify-between px-3 border-b border-foreground/10 relative">
                        <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                    </div>
                </aside>
            </>
        )
    }

    return (
        <>
            <motion.aside
                initial={false}
                animate={{ width: isOpen ? 240 : 70 }}
                className={cn(
                    "fixed top-0 left-0 z-40 h-screen print:hidden bg-background border-r border-foreground/10 transition-all duration-300 flex flex-col",
                    isMobile && "shadow-2xl"
                )}
            >
                {/* Navigation */}
                <nav className="flex-1 px-2.5 py-4 space-y-3.5 overflow-y-auto scrollbar-none relative z-10">
                    {(currentModule?.groups ?? []).map((group, groupIndex) => {
                        // Filter items based on permissions
                        const visibleItems = group.items.filter(item =>
                            !item.permission || can(item.permission)
                        );

                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={groupIndex} className="px-0.5">
                                {isOpen && (
                                    <h4 className="px-2.5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
                                        {group.label}
                                    </h4>
                                )}
                                <div className="space-y-0.5">
                                    {visibleItems.map((item) => {
                                        const isActive = item.href === current

                                        return (
                                            <Link key={item.href}
                                                href={item.href}
                                                onClick={() => { if (isMobile) setIsOpen(false); }}
                                                className={cn(
                                                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-150 group relative text-xs font-medium",
                                                    !isOpen && "justify-center px-0 w-9 mx-auto", // Center icons when collapsed
                                                    isActive
                                                        ? "bg-foreground/[0.06] text-foreground"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                                                )}
                                            >
                                                {/* Active: a primary rule on the left edge, the ledger gesture. */}
                                                {isActive && isOpen && (
                                                    <span aria-hidden className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary" />
                                                )}

                                                <div className={cn(
                                                    "h-[18px] w-[18px] flex items-center justify-center shrink-0 relative z-10",
                                                    !isOpen && "mx-auto"
                                                )}>
                                                    <item.icon className={cn(
                                                        "h-full w-full transition-all duration-300",
                                                        isActive ? "text-foreground" : "group-hover:text-foreground"
                                                    )} />
                                                </div>

                                                <AnimatePresence>
                                                    {isOpen && (
                                                        <motion.span
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, x: -10 }}
                                                            className="whitespace-nowrap text-sm relative z-10 font-medium"
                                                        >
                                                            {item.label}
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>


                                                {/* Tooltip for collapsed state */}
                                                {!isOpen && (
                                                    <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-foreground text-background text-[11px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                                                        {item.label}
                                                    </div>
                                                )}
                                            </Link>
                                        )
                                    })}
                                </div>
                                {/* Separator between groups */}
                                {groupIndex < (currentModule?.groups.length ?? 0) - 1 && isOpen && (
                                    <div className="mx-2.5 my-3 h-px bg-foreground/[0.06]" />
                                )}
                            </div>
                        )
                    })}
                </nav>

                {/* Footer Info */}
                <div className="p-4 border-t border-foreground/10">
                    <AnimatePresence mode="wait">
                        {isOpen ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-3"
                            >
                                <div className="px-1 space-y-1">
                                    <div className="flex justify-between gap-3 text-[11px] text-muted-foreground">
                                        <span>Company</span>
                                        <span className="truncate font-medium text-foreground" title={company?.name}>{company?.name ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between gap-3 text-[11px] text-muted-foreground">
                                        <span>Role</span>
                                        <span className="font-mono text-foreground">{company?.role ?? "—"}</span>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => {
                                        localStorage.removeItem("token");
                                        window.location.href = "/login";
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                    <LogOut className="h-3 w-3" />
                                    Sign out
                                </Button>
                            </motion.div>
                        ) : (
                            <div className="flex justify-center">
                                <Button
                                    onClick={() => {
                                        localStorage.removeItem("token");
                                        window.location.href = "/login";
                                    }}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    aria-label="Sign out"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.aside >

            {/* Mobile Overlay */}
            <AnimatePresence>
                {
                    isMobile && isOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
                        />
                    )
                }
            </AnimatePresence >
        </>
    )
}
