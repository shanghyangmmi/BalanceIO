"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Wallet, TrendingUp, CreditCard, Activity, ArrowUpRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatter"
import { Overview } from "@/components/dashboard/overview"
import { RecentSales } from "@/components/dashboard/recent-sales"
import { KpiCard } from "@/components/dashboard/kpi-card"

interface MetricsProps {
    data: any // using any for now to avoid circular deps type issues, ideally DashboardMetrics
}

export function BalanceCard() {
    return (
        <KpiCard
            title="Balance (Today)"
            value={0}
            format={(v) => formatCurrency(v)}
            icon={Wallet}
            accent="emerald"
            footer={
                <>
                    <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                    <span className="text-emerald-500 font-medium">0%</span>
                    <span className="ml-1">vs yesterday</span>
                </>
            }
        />
    )
}

export function RevenueCard({ data }: MetricsProps) {
    return (
        <KpiCard
            title="Revenue (YTD)"
            value={data?.totalRevenue ?? 0}
            format={(v) => formatCurrency(v)}
            icon={TrendingUp}
            accent="blue"
            valueClassName="text-blue-600"
            footer={
                <>
                    <span className="text-emerald-500 font-medium">
                        {data && data.revenueGrowth > 0 ? `+${data.revenueGrowth.toFixed(1)}%` : "0%"}
                    </span>
                    <span className="ml-1">vs last month</span>
                </>
            }
        />
    )
}

export function ExpensesCard({ data }: MetricsProps) {
    return (
        <KpiCard
            title="Expenses (YTD)"
            value={data?.totalExpenses ?? 0}
            format={(v) => formatCurrency(v)}
            icon={CreditCard}
            accent="rose"
            valueClassName="text-rose-600"
            footer={<span className="text-muted-foreground">Expense tracking active</span>}
        />
    )
}

export function InvoicesCard({ data }: MetricsProps) {
    return (
        <KpiCard
            title="Invoices"
            value={data?.salesCount ?? 0}
            icon={Activity}
            accent="orange"
            footer={<span className="text-muted-foreground">Total Generated</span>}
        />
    )
}

export function RevenueFlowChart() {
    return (
        <Card className="border shadow-sm bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Revenue Flow
                </CardTitle>
                <CardDescription>Real-time monthly comparison</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
                <Overview />
            </CardContent>
        </Card>
    )
}

export function ActivityStreamList() {
    return (
        <Card className="border shadow-sm bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5 text-purple-500" />
                    Recent Activity
                </CardTitle>
                <CardDescription>Latest system events</CardDescription>
            </CardHeader>
            <CardContent>
                <RecentSales />
            </CardContent>
        </Card>
    )
}
