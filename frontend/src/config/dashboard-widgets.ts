import { LayoutDashboard, PieChart, Wallet, TrendingUp, ShoppingBag, Activity } from "lucide-react"

export type WidgetType = "metrics" | "chart" | "list"

export interface DashboardWidgetConfig {
    id: string
    label: string
    description: string
    type: WidgetType
    defaultVisible: boolean
    minW?: string // col-span
}

export const DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
    {
        id: "balance-card",
        label: "Current Balance",
        description: "Shows today's balance vs yesterday",
        type: "metrics",
        defaultVisible: true,
    },
    {
        id: "revenue-card",
        label: "Total Revenue",
        description: "Year-to-date revenue metrics",
        type: "metrics",
        defaultVisible: true,
    },
    {
        id: "expenses-card",
        label: "Total Expenses",
        description: "Year-to-date expenses metrics",
        type: "metrics",
        defaultVisible: true,
    },
    {
        id: "invoices-card",
        label: "Invoices Generated",
        description: "Count of total invoices",
        type: "metrics",
        defaultVisible: true,
    },
    {
        id: "revenue-flow-chart",
        label: "Revenue Flow Chart",
        description: "Monthly revenue comparison chart",
        type: "chart",
        defaultVisible: true,
        minW: "col-span-1"
    },
    {
        id: "recent-activity-list",
        label: "Recent Activity",
        description: "Latest system events stream",
        type: "list",
        defaultVisible: true,
        minW: "col-span-1"
    }
]
