"use client"

import { Button } from "@/components/ui/button"
import { LayoutGrid, Menu, Sun, Moon, Laptop, User } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useTheme } from "next-themes"
import { usePathname, useSearchParams } from "next/navigation"
import { NotificationDropdown } from "./notification-dropdown"
import { siteConfig } from "@/config/site"
import { cn, parseJwt } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { usePermission } from "@/contexts/permission-context"
import { resolveModule } from "@/lib/module-nav"
import { Globe, Shield, LifeBuoy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SupportTicketDialog } from "@/components/support/support-ticket-dialog"

interface DashboardHeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

export function DashboardHeader({ sidebarOpen, setSidebarOpen }: DashboardHeaderProps) {
    const { setTheme } = useTheme()
    const { role, isAuditor } = usePermission()

    const pathname = usePathname()
    const activeModule = resolveModule(pathname)
    const searchParams = useSearchParams()
    const { language, setLanguage, t } = useLanguage()

    // User State
    const [user, setUser] = useState<{ name: string, email: string, initials: string } | null>(null)

    // We remove the breadcrumbs as requested by user for a cleaner look

    const [mounted, setMounted] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        setMounted(true)

        // Load User from Token
        const token = localStorage.getItem("token");
        if (token) {
            const decoded = parseJwt(token);
            if (decoded) {
                const name = decoded.Name || decoded.name || "User";
                const email = decoded.email || decoded.Email || "";
                const initials = name ? name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "U";
                setUser({ name, email, initials });
            }
        }
    }, [])

    // Trigger loading animation on navigation
    useEffect(() => {
        setIsLoading(true)
        setProgress(0)

        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) {
                    clearInterval(interval)
                    return 90
                }
                const next = prev + Math.random() * 15
                return next > 90 ? 90 : next
            })
        }, 100)

        const timer = setTimeout(() => {
            setProgress(100)
            setTimeout(() => {
                setIsLoading(false)
                setProgress(0)
            }, 300)
            clearInterval(interval)
        }, 800)

        return () => {
            clearInterval(interval)
            clearTimeout(timer)
        }
    }, [pathname, searchParams])

    if (!mounted) {
        return (
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 px-6 shadow-sm transition-all duration-300 overflow-hidden">
                {/* Premium Animated Background */}
                <div className="absolute inset-0 z-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60" />

                {/* Mesh Gradient Blobs */}
                <div className="absolute inset-0 z-0 opacity-30 dark:opacity-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 -left-4 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
                    <div className="absolute top-0 -right-4 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
                    <div className="absolute -bottom-8 left-20 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
                </div>

                {/* Premium Metallic Power Line (Loading State) */}
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-200/50 dark:bg-emerald-950/30 z-20" />

                <div className="relative z-10 flex w-full items-center gap-4">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="w-full flex-1" />
                    <div className="flex items-center justify-end gap-2">
                        <div className="h-9 w-9 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
                        <div className="h-9 w-9 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse" />
                        <div className="h-9 w-9 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse" />
                    </div>
                </div>
            </header>
        )
    }

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 px-3.5 sm:px-6 transition-all duration-300 glass-ultra border-b border-white/5 dark:border-white/10">
            {/* Ultra-Premium Performance Mesh (Sophisticated Slate-Green Flow) */}
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-600/10 via-slate-500/10 to-teal-600/10 dark:from-emerald-900/40 dark:via-zinc-800/40 dark:to-teal-900/40 animate-gradient-flow" />

            {/* Subtle Noise Texture for "Frosted" Feel */}
            <div className="absolute inset-0 z-0 bg-noise mix-blend-overlay opacity-40" />

            {/* Premium Rim Light (Top Highlight) */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent z-20" />

            {/* Premium Metallic Power Line (Separator) */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden z-20">
                {/* Background Line */}
                <div className="absolute inset-0 bg-zinc-200/50 dark:bg-emerald-950/30" />

                {isLoading ? (
                    <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                        style={{ width: `${progress}%` }}
                    >
                        {/* Shimmer Effect on the Progress Bar */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    </div>
                ) : (
                    /* Static Glowing Base (Normal State) */
                    <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/5" />
                )}

                {/* Fixed Border Base */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-emerald-500/10 dark:bg-emerald-500/20" />
            </div>

            <div className="relative z-30 flex w-full items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    <Menu className="h-5 w-5" />
                </Button>

                {/* Which module you are in, and the way back out.
                    The sidebar no longer lists the other modules, so this is
                    the only door back to the hub - it cannot be subtle. */}
                <Link
                    href="/dashboard"
                    title="Back to the module hub"
                    aria-label="Back to the module hub"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-background/50 text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                >
                    <LayoutGrid className="h-4 w-4" />
                </Link>

                {activeModule && (
                    <div className="flex min-w-0 items-center gap-2">
                        <activeModule.icon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" strokeWidth={1.75} />
                        <span className="truncate text-sm font-semibold text-foreground">
                            {activeModule.name}
                        </span>
                    </div>
                )}

                <div className="w-full flex-1" />

                <div className="flex items-center justify-end gap-3">
                    {isAuditor && (
                        <Badge variant="outline" className="hidden sm:inline-flex border-amber-300 text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/30 font-mono text-[10px] gap-1">
                            <Shield className="h-3 w-3 text-amber-600" /> Mode Auditor (Hanya Baca)
                        </Badge>
                    )}

                    <NotificationDropdown />

                    <SupportTicketDialog
                        trigger={
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 transition-all duration-200"
                                title="Support & Diagnostic"
                            >
                                <LifeBuoy className="h-4 w-4" />
                                <span className="sr-only">Support & Diagnostic</span>
                            </Button>
                        }
                    />

                    {/* Enhanced Separator */}
                    <div className="h-6 w-px bg-zinc-400/30 dark:bg-white/20 mx-1 shadow-sm" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 hover:scale-110 active:scale-95 transition-all duration-200">
                                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                                <span className="sr-only">Toggle theme</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-dropdown">
                            <DropdownMenuItem onClick={() => setTheme("light")}>
                                <Sun className="mr-2 h-4 w-4" /> Light
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("dark")}>
                                <Moon className="mr-2 h-4 w-4" /> Dark
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("system")}>
                                <Laptop className="mr-2 h-4 w-4" /> System
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-white/20 dark:ring-white/10 hover:ring-emerald-500/50 hover:scale-110 active:scale-95 transition-all duration-300 group overflow-hidden shadow-lg hover:shadow-emerald-500/20">
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold outline-none ring-0">
                                        {user?.initials || "U"}
                                    </AvatarFallback>
                                </Avatar>
                                {/* Animated Inner Shine */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 glass-dropdown">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                                        <Badge variant="secondary" className="font-mono text-[9px] px-1 py-0">{role}</Badge>
                                    </div>
                                    <p className="text-xs leading-none text-muted-foreground font-mono">
                                        {user?.email || ""}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => window.location.href = "/dashboard/settings"} className="cursor-pointer">
                                <User className="mr-2 h-4 w-4" />
                                {t("nav.profile")}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">{t("nav.billing")}</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">{t("nav.team")}</DropdownMenuItem>
                            <SupportTicketDialog
                                trigger={
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                                        <LifeBuoy className="mr-2 h-4 w-4" />
                                        Support & Diagnostic
                                    </DropdownMenuItem>
                                }
                            />
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2">
                                <Globe className="h-3 w-3" /> {t("nav.language")}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => setLanguage("en")}
                                className="cursor-pointer flex items-center justify-between"
                            >
                                English
                                {language === "en" && <span className="text-emerald-500">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setLanguage("id")}
                                className="cursor-pointer flex items-center justify-between"
                            >
                                Indonesia
                                {language === "id" && <span className="text-emerald-500">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => {
                                    localStorage.removeItem("token");
                                    window.location.href = "/login";
                                }}
                                className="text-red-500 cursor-pointer focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-900/10"
                            >
                                {t("nav.logout")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}
