"use client";

import { ExpenseForm } from "@/components/purchases/expense-form";

export default function NewExpensePage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-gradient">Recorded Expense</h2>
                <p className="text-muted-foreground">Record a business expense paid from a bank or cash account.</p>
            </div>

            <div className="mx-auto max-w-2xl">
                <ExpenseForm />
            </div>
        </div>
    );
}
