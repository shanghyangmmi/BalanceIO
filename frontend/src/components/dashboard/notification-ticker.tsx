"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface NotificationTickerProps {
    messages?: string[]
    className?: string
}

export function NotificationTicker({ messages = [], className }: NotificationTickerProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [tempMessage, setTempMessage] = useState<string | null>(null)
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        const handleNotification = (e: CustomEvent<string>) => {
            setTempMessage(e.detail)
            setIsVisible(true)
            setTimeout(() => {
                setIsVisible(false)
                setTimeout(() => {
                    setTempMessage(null)
                    setIsVisible(true)
                }, 500)
            }, 5000)
        }

        window.addEventListener('APP_NOTIFICATION', handleNotification as EventListener);
        return () => window.removeEventListener('APP_NOTIFICATION', handleNotification as EventListener);
    }, []);

    useEffect(() => {
        if (messages.length <= 1) return

        const interval = setInterval(() => {
            setIsVisible(false) // Fade out
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % messages.length)
                setIsVisible(true) // Fade in
            }, 500) // Wait for fade out
        }, 5000) // Display duration

        return () => clearInterval(interval)
    }, [messages.length])

    const currentMessage = tempMessage || messages[currentIndex] || "System Online"

    return (
        <div className={cn("flex items-center overflow-hidden h-9 px-4 bg-muted/30 rounded-full border border-border/50 max-w-md w-full", className)}>
            <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                <span
                    className={cn(
                        "transition-opacity duration-500 line-clamp-1",
                        isVisible ? "opacity-100" : "opacity-0"
                    )}
                >
                    {currentMessage}
                </span>
            </div>
        </div>
    )
}
