"use client"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { User } from "lucide-react"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { formatCurrency } from "@/lib/utils/formatter"

interface RecentSale {
    name: string
    email: string
    amount: number
    avatar: string
}

export function RecentSales() {
    const [sales, setSales] = useState<RecentSale[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchSales() {
            try {
                const data = await apiClient.get<RecentSale[]>("/dashboard/recent-sales")
                setSales(data)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchSales()
    }, [])

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                        <div className="ml-4 space-y-2">
                            <div className="h-4 w-[150px] bg-zinc-100 dark:bg-zinc-800 rounded" />
                            <div className="h-3 w-[100px] bg-zinc-100 dark:bg-zinc-800 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (sales.length === 0) {
        return <div className="text-sm text-muted-foreground">No recent activity found.</div>
    }

    return (
        <div className="space-y-8">
            {sales.map((sale, i) => (
                <div key={i} className="flex items-center">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={sale.avatar} alt={sale.name} />
                        <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800">
                            <User className="h-4 w-4 text-zinc-500" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{sale.name}</p>
                        <p className="text-sm text-muted-foreground">
                            {sale.email}
                        </p>
                    </div>
                    <div className="ml-auto font-medium">{formatCurrency(sale.amount)}</div>
                </div>
            ))}
        </div>
    )
}
