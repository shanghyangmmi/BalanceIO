"use client"

import { useEffect, useState } from "react"
import { OrderForm } from "@/components/purchases/order-form"
import { apiClient } from "@/lib/api-client"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface OrderDetailViewProps {
    id: string
}

export function OrderDetailView({ id }: OrderDetailViewProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadOrder()
    }, [])

    const loadOrder = async () => {
        try {
            const data = await apiClient.getPurchaseOrder(id)
            setOrder(data)
        } catch (error) {
            toast.error("Failed to fetch order details")
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    if (!order) {
        return <div className="p-8 text-center text-muted-foreground">Order not found</div>
    }

    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                    {order.status === 0 ? "Edit Purchase Order" : "View Purchase Order"}
                </h2>
                <div className="text-sm text-muted-foreground font-mono">
                    {order.orderNumber}
                </div>
            </div>

            <OrderForm existingOrder={order} />
        </div>
    )
}
