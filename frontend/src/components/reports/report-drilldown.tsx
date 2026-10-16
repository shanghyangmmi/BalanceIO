"use client"

import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

interface ReportLineDrilldownProps {
    label: string;
    accountId?: string;
    amount: number;
    hasSubAccounts?: boolean;
}

export function ReportDrilldown({ label, accountId, amount, hasSubAccounts }: ReportLineDrilldownProps) {
    if (!accountId) {
        return (
            <div className="flex justify-between py-2 items-center">
                <span className="font-medium">{label}</span>
                <span className="font-medium">{amount.toLocaleString()}</span>
            </div>
        )
    }

    return (
        <Link href={`/dashboard/accounting/ledger?account=${accountId}`} className="block group">
            <div className="flex justify-between py-2 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded px-2 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                    <span className={`${hasSubAccounts ? 'font-medium' : 'pl-4 text-zinc-600'}`}>{label}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className={`${hasSubAccounts ? 'font-medium' : 'text-zinc-600'}`}>{amount.toLocaleString()}</span>
            </div>
        </Link>
    )
}
