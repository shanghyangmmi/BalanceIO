"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Check, LayoutGrid, LifeBuoy, Menu, Moon, Sun, Laptop } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { parseJwt } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { usePermission } from "@/contexts/permission-context"
import { resolveModule } from "@/lib/module-nav"
import { SupportTicketDialog } from "@/components/support/support-ticket-dialog"
import { NotificationDropdown } from "./notification-dropdown"

interface DashboardHeaderProps {
    sidebarOpen: boolean
    setSidebarOpen: (open: boolean) => void
}

const iconButton = "h-9 w-9 rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"

export function DashboardHeader({ sidebarOpen, setSidebarOpen }: DashboardHeaderProps) {
    const { setTheme } = useTheme()
    const { role, isAuditor } = usePermission()
    const { language, setLanguage, t } = useLanguage()
    const activeModule = resolveModule(usePathname())

    const [user, setUser] = useState<{ name: string; email: string; initials: string } | null>(null)

    useEffect(() => {
        const token = localStorage.getItem("token")
        if (!token) return
        const decoded = parseJwt(token)
        if (!decoded) return
        const name: string = decoded.Name || decoded.name || "User"
        const email: string = decoded.email || decoded.Email || ""
        const initials = name
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase()
        setUser({ name, email, initials: initials || "U" })
    }, [])

    const signOut = () => {
        localStorage.removeItem("token")
        window.location.href = "/login"
    }

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-foreground/10 bg-background/85 px-3.5 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6">
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Open navigation"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Which module you are in, and the way back out. The sidebar does
                not list the other modules, so this is the only door back to
                the hub - it cannot be subtle. */}
            <Link
                href="/dashboard"
                title="Back to the module hub"
                aria-label="Back to the module hub"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/10 text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
            >
                <LayoutGrid className="h-4 w-4" />
            </Link>

            {activeModule && (
                <div className="flex min-w-0 items-center gap-2">
                    <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden>
                        /
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">{activeModule.name}</span>
                </div>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-1.5">
                {isAuditor && (
                    <span className="mr-2 hidden rounded-full border border-foreground/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline-flex">
                        Read-only
                    </span>
                )}

                <NotificationDropdown />

                <SupportTicketDialog
                    trigger={
                        <Button variant="ghost" size="icon" className={iconButton} title="Support">
                            <LifeBuoy className="h-4 w-4" />
                            <span className="sr-only">Support</span>
                        </Button>
                    }
                />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className={iconButton}>
                            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span className="sr-only">Theme</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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

                <div className="mx-1.5 h-5 w-px bg-foreground/10" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="h-8 w-8 rounded-full p-0 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/30"
                            aria-label="Account"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-foreground font-mono text-[10px] font-medium tracking-wider text-background">
                                    {user?.initials || "U"}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel className="font-normal">
                            <p className="text-sm font-medium text-foreground">{user?.name || "User"}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</p>
                            {role && (
                                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                    {role}
                                </p>
                            )}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings/security">{t("nav.profile")}</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings/subscription">{t("nav.billing")}</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings/users">{t("nav.team")}</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                            {t("nav.language")}
                        </DropdownMenuLabel>
                        {(
                            [
                                ["en", "English"],
                                ["id", "Bahasa Indonesia"],
                            ] as const
                        ).map(([code, label]) => (
                            <DropdownMenuItem
                                key={code}
                                onClick={() => setLanguage(code)}
                                className="flex items-center justify-between"
                            >
                                {label}
                                {language === code && <Check className="h-3.5 w-3.5 text-foreground" />}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                            {t("nav.logout")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
