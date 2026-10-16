"use client"

import { OrderForm } from "@/components/purchases/order-form"

export default function NewOrderPage() {
    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-gradient">Create Purchase Order</h2>
            </div>
            <OrderForm />
        </div>
    )
}
