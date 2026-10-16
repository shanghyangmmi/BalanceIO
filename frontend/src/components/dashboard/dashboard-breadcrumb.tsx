"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Fragment } from "react"

const routeNameMap: Record<string, string> = {
    dashboard: "Dashboard",
    accounting: "Accounting",
    coa: "Chart of Accounts",
    journal: "Journal Entries",
    ledger: "General Ledger",
    reports: "Reports",
    sales: "Sales",
    invoices: "Invoices",
    customers: "Customers",
    purchases: "Purchases",
    inventory: "Inventory",
    assets: "Assets",
    settings: "Settings",
    new: "Create New",
    "[id]": "Details" // Basic fallback
}

export function DashboardBreadcrumb() {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)

    // Remove 'dashboard' from display if it's the root, or handle nicely
    // Let's keep it but capitalized

    return (
        <Breadcrumb className="hidden md:flex mb-4">
            <BreadcrumbList>
                {segments.map((segment, index) => {
                    const isLast = index === segments.length - 1
                    const href = `/${segments.slice(0, index + 1).join("/")}`
                    const name = routeNameMap[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())

                    return (
                        <Fragment key={href}>
                            <BreadcrumbItem>
                                {!isLast ? (
                                    <BreadcrumbLink asChild>
                                        <Link href={href}>{name}</Link>
                                    </BreadcrumbLink>
                                ) : (
                                    <BreadcrumbPage>{name}</BreadcrumbPage>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator />}
                        </Fragment>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
