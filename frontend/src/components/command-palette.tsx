"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import {
    LayoutDashboard,
    PieChart,
    FileSpreadsheet,
    Box,
    TrendingUp,
    ShoppingBag,
    Wallet,
    Calculator,
    FileText,
    Users,
    Folder,
    Settings,
    PlusCircle,
    Receipt,
    Moon,
    Sun,
    BookOpen,
    Landmark,
    ShieldCheck,
} from "lucide-react"

interface PaletteItem {
    label: string
    href?: string
    action?: () => void
    icon: React.ElementType
    keywords?: string
    shortcut?: string
}

/**
 * Global ⌘K Command Palette — the fastest way to move through BalanceIO.
 * Opens with Cmd+K (macOS) / Ctrl+K (Windows). Type to fuzzy-search
 * pages and actions; Enter to execute.
 */
export function CommandPalette() {
    const [open, setOpen] = React.useState(false)
    const [mounted, setMounted] = React.useState(false)
    const router = useRouter()
    const { setTheme, resolvedTheme } = useTheme()

    React.useEffect(() => {
        setMounted(true)
    }, [])

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((v) => !v)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    if (!mounted) {
        return null
    }

    const run = (item: PaletteItem) => {
        setOpen(false)
        if (item.action) {
            item.action()
        } else if (item.href) {
            router.push(item.href)
        }
    }

    const quickActions: PaletteItem[] = [
        {
            label: "New Journal Entry",
            href: "/dashboard/accounting/journal/new",
            icon: PlusCircle,
            keywords: "jurnal entry transaksi debit kredit baru",
            shortcut: "⌘N",
        },
        {
            label: "Create Sales Invoice",
            href: "/dashboard/sales/new",
            icon: Receipt,
            keywords: "faktur tagihan invoice jual sales baru",
        },
        {
            label: "Toggle Dark / Light Theme",
            action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
            icon: resolvedTheme === "dark" ? Sun : Moon,
            keywords: "mode gelap terang tema theme dark light",
        },
    ]

    const navigation: PaletteItem[] = [
        { label: "Dashboard Overview", href: "/dashboard", icon: LayoutDashboard, keywords: "home beranda" },
        { label: "Financial Reports", href: "/dashboard/reports", icon: PieChart, keywords: "laporan keuangan" },
        { label: "Chart of Accounts (CoA)", href: "/dashboard/accounting/coa", icon: BookOpen, keywords: "akun perkiraan coa" },
        { label: "General Journal", href: "/dashboard/accounting/journal", icon: FileSpreadsheet, keywords: "jurnal umum entries" },
        { label: "Journal Approvals Hub", href: "/dashboard/accounting/approvals", icon: ShieldCheck, keywords: "persetujuan approval manager jurnal post draft" },
        { label: "General Ledger", href: "/dashboard/accounting/ledger", icon: Box, keywords: "buku besar" },
        { label: "Sales & Invoices", href: "/dashboard/sales", icon: TrendingUp, keywords: "penjualan piutang" },
        { label: "Purchases & Expenses", href: "/dashboard/purchases", icon: ShoppingBag, keywords: "pembelian beban" },
        { label: "Inventory", href: "/dashboard/inventory", icon: Box, keywords: "stok barang produk" },
        { label: "Assets", href: "/dashboard/assets", icon: Wallet, keywords: "aset tetap penyusutan" },
        { label: "Tax Compliance", href: "/dashboard/tax", icon: Calculator, keywords: "pajak ppn pph" },
        { label: "Financial Documents", href: "/dashboard/documents", icon: FileText, keywords: "dokumen arsip" },
        { label: "Contacts", href: "/dashboard/contacts", icon: Users, keywords: "kontak customer vendor pelanggan" },
        { label: "Projects", href: "/dashboard/projects", icon: Folder, keywords: "proyek" },
        { label: "Settings", href: "/dashboard/settings", icon: Settings, keywords: "pengaturan preferensi users" },
    ]

    const reports: PaletteItem[] = [
        { label: "Statement of Financial Position", href: "/dashboard/reports/balance-sheet", icon: Landmark, keywords: "neraca posisi keuangan balance sheet", shortcut: "⌘B" },
        { label: "Statement of Profit or Loss", href: "/dashboard/reports/profit-loss", icon: TrendingUp, keywords: "laba rugi income statement profit loss" },
        { label: "Statement of Cash Flows", href: "/dashboard/reports/cash-flow", icon: Wallet, keywords: "arus kas cash flow" },
        { label: "Trial Balance", href: "/dashboard/reports/trial-balance", icon: FileSpreadsheet, keywords: "neraca saldo" },
        { label: "Aged Receivables", href: "/dashboard/reports/aged-receivables", icon: FileText, keywords: "piutang umur" },
        { label: "Aged Payables", href: "/dashboard/reports/aged-payables", icon: FileText, keywords: "hutang umur" },
    ]

    const renderGroup = (heading: string, items: PaletteItem[]) => (
        <CommandGroup heading={heading}>
            {items.map((item) => (
                <CommandItem
                    key={item.label}
                    value={`${item.label} ${item.keywords ?? ""}`}
                    onSelect={() => run(item)}
                    className="cursor-pointer"
                >
                    <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                    {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
            ))}
        </CommandGroup>
    )

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search… (pages, reports, actions)" />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                {renderGroup("Quick Actions", quickActions)}
                <CommandSeparator />
                {renderGroup("Navigation", navigation)}
                <CommandSeparator />
                {renderGroup("Reports", reports)}
            </CommandList>
        </CommandDialog>
    )
}
