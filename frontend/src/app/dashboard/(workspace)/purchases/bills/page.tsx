"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { PlusCircle, Loader2, MoreHorizontal, Trash, Eye, Wallet } from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils/formatter"
import { Badge } from "@/components/ui/badge"
import { ColumnDef } from "@tanstack/react-table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { PayBillModal } from "@/components/purchases/pay-bill-modal"

// Define helper types locally or import if available
interface PurchaseBill {
    id: string
    billNumber: string
    vendorInvoiceNumber?: string
    contact?: { name: string }
    billDate: string
    dueDate: string
    currency?: string
    exchangeRate?: number
    total: number
    amountDue: number
    status: number // 0=Draft, 1=Pending, 2=Posted, 3=Overdue, 4=Paid, 9=Void
}

const billStatusLabels: Record<number, string> = {
    0: "Draft",
    1: "Pending",
    2: "Posted",
    3: "Overdue",
    4: "Paid",
    9: "Void"
}

export default function BillsPage() {
    const [bills, setBills] = useState<PurchaseBill[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedBillForPayment, setSelectedBillForPayment] = useState<PurchaseBill | null>(null)

    const fetchBills = async () => {
        try {
            setLoading(true)
            const data = await apiClient.getPurchaseBills()
            setBills(data)
        } catch (error) {
            console.error("Failed to fetch bills", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchBills()
    }, [])

    const columns: ColumnDef<PurchaseBill>[] = [
        {
            accessorKey: "billNumber",
            header: "Bill #",
            cell: ({ row }) => <span className="font-mono">{row.getValue("billNumber")}</span>
        },
        {
            accessorKey: "contact.name",
            header: "Vendor",
            cell: ({ row }) => row.original.contact?.name || "-"
        },
        {
            accessorKey: "billDate",
            header: "Date",
            cell: ({ row }) => formatDate(row.getValue("billDate"))
        },
        {
            accessorKey: "dueDate",
            header: "Due Date",
            cell: ({ row }) => formatDate(row.getValue("dueDate"))
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status
                const label = billStatusLabels[status] || "Unknown"
                let variant: "default" | "secondary" | "destructive" | "outline" = "outline"

                if (status === 2) variant = "default" // Posted
                if (status === 4) variant = "secondary" // Paid
                if (status === 3) variant = "destructive" // Overdue
                if (status === 0) variant = "outline" // Draft

                return <Badge variant={variant}>{label}</Badge>
            }
        },
        {
            accessorKey: "total",
            header: ({ column }) => <div className="text-right">Total</div>,
            cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.getValue("total"))}</div>
        },
        {
            accessorKey: "amountDue",
            header: ({ column }) => <div className="text-right">Amount Due</div>,
            cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.getValue("amountDue"))}</div>
        },
        {
            id: "actions",
            cell: ({ row }) => {
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.billNumber)}>
                                Copy Bill #
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {row.original.status !== 4 && row.original.status !== 9 && row.original.amountDue > 0 && (
                                <DropdownMenuItem className="text-emerald-600 font-medium" onClick={() => setSelectedBillForPayment(row.original)}>
                                    <Wallet className="mr-2 h-4 w-4" /> Pay Bill
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(row.original.id)}>
                                <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        },
    ]

    const handleDelete = async (id: string) => {
        toast.warning("Are you sure you want to delete this bill?", {
            action: {
                label: "Delete",
                onClick: async () => {
                    try {
                        await apiClient.deletePurchaseBill(id)
                        toast.success("Bill deleted successfully")
                        // Refresh list
                        const data = await apiClient.getPurchaseBills()
                        setBills(data)
                    } catch (error: any) {
                        toast.error("Failed to delete bill")
                    }
                }
            }
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gradient">Purchase Bills</h2>
                    <p className="text-muted-foreground">Manage your incoming bills and expenses.</p>
                </div>
                <Link href="/dashboard/purchases/bills/new">
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" /> New Bill
                    </Button>
                </Link>
            </div>

            <DataTable
                columns={columns}
                data={bills}
                filterColumn="billNumber"
                filterPlaceholder="Search bills..."
            />

            {selectedBillForPayment && (
                <PayBillModal
                    isOpen={!!selectedBillForPayment}
                    onClose={() => setSelectedBillForPayment(null)}
                    billId={selectedBillForPayment.id}
                    billNumber={selectedBillForPayment.billNumber}
                    vendorName={selectedBillForPayment.contact?.name || "Vendor"}
                    amountDue={selectedBillForPayment.amountDue}
                    currency={selectedBillForPayment.currency || "IDR"}
                    bookedExchangeRate={selectedBillForPayment.exchangeRate || 1}
                    onSuccess={() => {
                        fetchBills()
                    }}
                />
            )}
        </div>
    )
}
