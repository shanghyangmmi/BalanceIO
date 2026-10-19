"use client";

import { ExpenseForm } from "@/components/purchases/expense-form";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function NewExpensePage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Recorded Expense</h2>
                <p className="text-muted-foreground">Record a business expense paid from a bank or cash account.</p>
            </div>

            <div className="mx-auto max-w-2xl">
                <RBACGuard permission={PERMISSIONS.FinanceCreate} fallback={<NoPermission permission={PERMISSIONS.FinanceCreate} />}>
<ExpenseForm />
</RBACGuard>
            </div>
        </div>
    );
}
