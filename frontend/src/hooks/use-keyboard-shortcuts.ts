"use client"

import { useEffect } from "react"


export function useKeyboardShortcuts() {


    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Meta (Cmd) or Ctrl key
            if (event.metaKey || event.ctrlKey) {
                switch (event.key) {
                    case "b":
                        event.preventDefault()
                        window.location.href = "/dashboard/reports/balance-sheet"
                        break
                    case "i":
                        event.preventDefault()
                        if (event.shiftKey) {
                            window.location.href = "/dashboard/sales/invoices/new"
                        } else {
                            window.location.href = "/dashboard/sales/invoices"
                        }
                        break
                    case "j":
                        event.preventDefault()
                        if (event.shiftKey) {
                            window.location.href = "/dashboard/accounting/journal/new"
                        } else {
                            window.location.href = "/dashboard/accounting/journal"
                        }
                        break
                    case "/":
                        event.preventDefault()
                        // Focus search (simulated by triggering the header event listener if feasible, or handled separately)
                        // For now just route to search/dashboard
                        break
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])
}
