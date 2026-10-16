"use client"

import { BillForm } from "@/components/purchases/bill-form"

export default function NewBillPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Create Purchase Bill</h2>
      </div>
      <BillForm />
    </div>
  )
}
