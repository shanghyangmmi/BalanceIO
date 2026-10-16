"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full">
                <span className="sr-only">Toggle theme</span>
            </Button>
        )
    }

    const isDark = resolvedTheme === "dark" || theme === "dark"

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 dark:border-white/10 light:border-zinc-200 transition-all text-zinc-500 dark:text-zinc-400"
        >
            {isDark ? (
                <Sun className="h-4 w-4 text-amber-400" />
            ) : (
                <Moon className="h-4 w-4 text-zinc-700" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
