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
                        "fixed top-0 left-0 z-40 h-screen print:hidden bg-zinc-50/50 dark:bg-zinc-900/50 border-r border-[#E0E0E0] dark:border-white/10 transition-all duration-300 w-[240px]",
                        !isOpen && "-translate-x-full md:translate-x-0 md:w-[70px]",
                        isMobile && "shadow-2xl"
                    )}
                >
                    <div className="h-16 flex items-center justify-between px-3 border-b border-dashed border-zinc-200/50 dark:border-white/5 relative">
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
                    "fixed top-0 left-0 z-40 h-screen print:hidden bg-zinc-50/50 dark:bg-zinc-900/50 border-r border-[#E0E0E0] dark:border-white/10 transition-all duration-300 flex flex-col",
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
                                    <h4 className="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 opacity-80">
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
                                                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 group relative overflow-hidden text-xs font-medium",
                                                    !isOpen && "justify-center px-0 w-9 mx-auto", // Center icons when collapsed
                                                    isActive
                                                        ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-semibold shadow-sm ring-1 ring-emerald-500/20"
                                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-white/5 active:scale-95"
                                                )}
                                            >
                                                {/* Aurora Background for Active Item */}
                                                {isActive && (
                                                    <div className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent animate-gradient-flow opacity-70" />
                                                )}

                                                <div className={cn(
                                                    "h-[18px] w-[18px] flex items-center justify-center shrink-0 relative z-10",
                                                    !isOpen && "mx-auto"
                                                )}>
                                                    <item.icon className={cn(
                                                        "h-full w-full transition-all duration-300",
                                                        isActive ? "text-emerald-600 dark:text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "group-hover:text-zinc-900 dark:group-hover:text-white"
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

                                                {/* Active Indicator Dot */}
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="active-dot"
                                                        className={cn(
                                                            "absolute rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] z-10",
                                                            isOpen ? "right-2 h-1 w-1" : "bottom-1 left-1/2 -translate-x-1/2 h-1 w-1.5"
                                                        )}
                                                    />
                                                )}

                                                {/* Tooltip for collapsed state */}
                                                {!isOpen && (
                                                    <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-2xl ring-1 ring-white/10">
                                                        {item.label}
                                                    </div>
                                                )}
                                            </Link>
                                        )
                                    })}
                                </div>
                                {/* Separator between groups */}
                                {groupIndex < (currentModule?.groups.length ?? 0) - 1 && isOpen && (
                                    <div className="mx-5 my-3 h-px bg-white/5 border-t border-dashed border-zinc-200/50 dark:border-white/5" />
                                )}
                            </div>
                        )
                    })}
                </nav>

                {/* Footer Info */}
                <div className="p-4 border-t border-dashed border-zinc-200/50 dark:border-white/5 bg-zinc-50/30 dark:bg-zinc-900/30 backdrop-blur-sm">
                    <AnimatePresence mode="wait">
                        {isOpen ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-3"
                            >
                                <div className="px-1 space-y-1">
                                    <div className="flex justify-between gap-3 text-[10px] text-zinc-400">
                                        <span>Company</span>
                                        <span className="truncate font-semibold text-zinc-600 dark:text-zinc-300" title={company?.name}>{company?.name ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between gap-3 text-[10px] text-zinc-400">
                                        <span>Role</span>
                                        <span className="font-mono font-semibold text-zinc-600 dark:text-zinc-300">{company?.role ?? "—"}</span>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => {
                                        localStorage.removeItem("token");
                                        window.location.href = "/login";
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-8 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95"
                                >
                                    <LogOut className="h-3 w-3" />
                                    Sign Out
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
                                    className="h-8 w-8 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
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
