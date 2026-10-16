"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Check, ChevronDown, Laptop, LogOut, Moon, Settings, Sun, Users } from "lucide-react"

import { cn, parseJwt } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCompany } from "@/contexts/company-context"
import { NotificationDropdown } from "./notification-dropdown"

/**
 * The hub's only chrome.
 *
 * Deliberately thinner than the workspace header: no sidebar toggle, no
 * breadcrumb, no search. On the page whose entire job is "pick a module",
 * the only things worth reaching for are which company you are in and who
 * you are signed in as.
 */
export function HubNavbar() {
  const { setTheme } = useTheme()
  const { company, companies, setCompany } = useCompany()

  const [user, setUser] = React.useState<{
    name: string
    email: string
    initials: string
  } | null>(null)

  React.useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return
    const decoded = parseJwt(token)
    if (!decoded) return

    const name = decoded.Name || decoded.name || "User"
    const email = decoded.email || decoded.Email || ""
    const initials = name
      ? name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
      : "U"
    setUser({ name, email, initials })
  }, [])

  const signOut = () => {
    localStorage.removeItem("token")
    window.location.href = "/login"
  }

  return (
    <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            {siteConfig.name}
          </span>

          <span aria-hidden className="h-4 w-px shrink-0 bg-foreground/10" />

          {companies && companies.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <span className="truncate">{company?.name ?? "Select company"}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Company
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {companies.map((c: any) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setCompany(c)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{c.name}</span>
                    {c.id === company?.id && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="truncate text-sm text-muted-foreground">
              {company?.name ?? ""}
            </span>
          )}
        </div>

        {/* ── Account ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Contacts is here rather than in any module menu.
              One party can be a customer, a supplier and an employee at
              once, so it belongs to no single module — it is shared
              configuration, and repeating it in four sidebars would imply
              four different lists. */}
          <Link
            href="/dashboard/contacts"
            title="Contacts"
            aria-label="Contacts"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <Users className="h-4 w-4" strokeWidth={1.75} />
          </Link>

          <NotificationDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 pl-1.5 pr-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-foreground/[0.06] text-[10px] font-semibold text-foreground">
                    {user?.initials ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-0.5">
                <div className="text-sm font-medium text-foreground">
                  {user?.name ?? "User"}
                </div>
                {user?.email && (
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </div>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/contacts">
                  <Users className="mr-2 h-4 w-4" /> Contacts
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
