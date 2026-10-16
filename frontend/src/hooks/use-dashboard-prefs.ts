"use client"

import { useState, useEffect } from "react"
import { DASHBOARD_WIDGETS, DashboardWidgetConfig } from "@/config/dashboard-widgets"

const STORAGE_KEY = "balanceio_dashboard_prefs_v1"

interface DashboardPrefs {
    visibleWidgets: string[]
    widgetOrder: string[]
}

const DEFAULT_ORDER = DASHBOARD_WIDGETS.map(w => w.id)

export function useDashboardPrefs() {
    const [prefs, setPrefs] = useState<DashboardPrefs>({
        visibleWidgets: DEFAULT_ORDER,
        widgetOrder: DEFAULT_ORDER
    })
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        const loadPrefs = () => {
            try {
                const stored = localStorage.getItem(STORAGE_KEY)
                if (stored) {
                    const parsed = JSON.parse(stored)
                    // Merge with defaults to handle new widgets
                    const mergedOrder = Array.from(new Set([...parsed.widgetOrder, ...DEFAULT_ORDER]))
                    setPrefs({
                        visibleWidgets: parsed.visibleWidgets || DEFAULT_ORDER,
                        widgetOrder: mergedOrder
                    })
                }
            } catch (e) {
                console.error("Failed to load dashboard prefs", e)
            } finally {
                setIsLoaded(true)
            }
        }
        loadPrefs()
    }, [])

    const savePrefs = (newPrefs: DashboardPrefs) => {
        setPrefs(newPrefs)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs))
    }

    const toggleWidget = (widgetId: string) => {
        const isVisible = prefs.visibleWidgets.includes(widgetId)
        const newVisible = isVisible
            ? prefs.visibleWidgets.filter(id => id !== widgetId)
            : [...prefs.visibleWidgets, widgetId]

        savePrefs({ ...prefs, visibleWidgets: newVisible })
    }

    const moveWidget = (widgetId: string, direction: "up" | "down") => {
        const currentOrder = [...prefs.widgetOrder]
        const idx = currentOrder.indexOf(widgetId)
        if (idx === -1) return

        if (direction === "up" && idx > 0) {
            [currentOrder[idx], currentOrder[idx - 1]] = [currentOrder[idx - 1], currentOrder[idx]]
        } else if (direction === "down" && idx < currentOrder.length - 1) {
            [currentOrder[idx], currentOrder[idx + 1]] = [currentOrder[idx + 1], currentOrder[idx]]
        }

        savePrefs({ ...prefs, widgetOrder: currentOrder })
    }

    return {
        visibleWidgets: prefs.visibleWidgets,
        widgetOrder: prefs.widgetOrder,
        toggleWidget,
        moveWidget,
        isLoaded
    }
}
