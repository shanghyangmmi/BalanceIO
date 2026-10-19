"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, Clock, CreditCard, ShoppingBag, AlertTriangle, Info } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { formatDistanceToNow } from "date-fns"

interface Notification {
    id: string
    title: string
    message: string
    type: string // 'info' | 'success' | 'warning' | 'error'
    createdAt: string
    isRead: boolean
}

export function NotificationDropdown() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)

    const unreadCount = notifications.filter(n => !n.isRead).length

    useEffect(() => {
        setMounted(true)
        fetchNotifications()
        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [])

    async function fetchNotifications() {
        try {
            const data = await apiClient.get<Notification[]>("/notifications?limit=10")
            setNotifications(data)
        } catch (error) {
            console.error("Failed to fetch notifications", error)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))

        try {
            await apiClient.post(`/notifications/${id}/read`, {})
        } catch (error) {
            console.error("Failed to mark notification as read", error)
        }
    }

    const markAllRead = async () => {
        // Optimistic update
        setNotifications(notifications.map(n => ({ ...n, isRead: true })))

        try {
            await apiClient.post("/notifications/read-all", {})
        } catch (error) {
            console.error("Failed to mark all as read", error)
        }
    }

    function getIcon(type: string) {
        switch (type) {
            case 'success': return CreditCard
            case 'warning': return AlertTriangle
            case 'error': return AlertTriangle
            default: return Info
        }
    }

    function getIconColor(type: string) {
        switch (type) {
            case 'success': return "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
            case 'warning': return "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            case 'error': return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            default: return "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
        }
    }

    if (!mounted) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 hover:scale-110 active:scale-95 transition-all duration-200">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto px-2 text-xs text-emerald-500 hover:text-emerald-600" onClick={markAllRead}>
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    <div className="grid gap-1 p-1">
                        {loading ? (
                            <div className="p-4 text-center text-muted-foreground text-xs">Loading...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                                No notifications
                            </div>
                        ) : (
                            notifications.map((notification) => {
                                const Icon = getIcon(notification.type)
                                return (
                                    <DropdownMenuItem
                                        key={notification.id}
                                        className={cn(
                                            "flex items-start gap-3 p-3 cursor-pointer",
                                            !notification.isRead && "bg-cyan-50/50 dark:bg-cyan-900/10"
                                        )}
                                        onClick={() => markAsRead(notification.id)}
                                    >
                                        <div className={cn(
                                            "mt-1 h-8 w-8 shrink-0 rounded-full flex items-center justify-center",
                                            getIconColor(notification.type)
                                        )}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="grid gap-1">
                                            <div className="font-semibold text-sm">{notification.title}</div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                            </div>
                                        </div>
                                        {!notification.isRead && (
                                            <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                                        )}
                                    </DropdownMenuItem>
                                )
                            })
                        )}
                    </div>
                </ScrollArea>
                <div className="p-2 border-t text-center">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                        View all activity
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
