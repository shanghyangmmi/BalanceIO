"use client"

import { useEffect, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { PlusCircle, Loader2, MoreHorizontal, Trash, Eye, CheckCircle, Package } from "lucide-react"
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
import { useRouter } from "next/navigation"

interface PurchaseOrder {
  id: string
  orderNumber: string
  reference?: string
  contact?: { name: string }
  orderDate: string
  deliveryDate?: string
  totalAmount: number
  status: number // 0=Draft, 1=Approved, 2=Received, 3=Cancelled
}

const statusLabels: Record<number, string> = {
  0: "Draft",
  1: "Approved",
  2: "Received",
  3: "Cancelled"
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      const data = await apiClient.getPurchaseOrders()
      setOrders(data)
    } catch (error) {
      toast.error("Failed to fetch purchase orders")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await apiClient.approvePurchaseOrder(id)
      toast.success("Order approved")
      loadOrders()
    } catch (error) {
      toast.error("Failed to approve order")
    }
  }

  const handleReceive = async (id: string) => {
    try {
      await apiClient.receivePurchaseOrder(id)
      toast.success("Order received and stock updated")
      loadOrders()
    } catch (error) {
      toast.error("Failed to receive order")
    }
  }

  const handleDelete = async (id: string) => {
    toast.warning("Delete this order?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await apiClient.deletePurchaseOrder(id)
            toast.success("Order deleted")
            loadOrders()
          } catch (error) {
            toast.error("Failed to delete order")
          }
        }
      }
    })
  }

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => <span className="font-mono font-medium">{row.getValue("orderNumber")}</span>
    },
    {
      accessorKey: "contact.name",
      header: "Vendor",
      cell: ({ row }) => row.original.contact?.name || "-"
    },
    {
      accessorKey: "orderDate",
      header: "Date",
      cell: ({ row }) => formatDate(row.getValue("orderDate"))
    },
    {
      accessorKey: "deliveryDate",
      header: "Expected Delivery",
      cell: ({ row }) => row.original.deliveryDate ? formatDate(row.original.deliveryDate) : "-"
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status
        const label = statusLabels[status] || "Unknown"
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline"

        if (status === 1) variant = "secondary" // Approved
        if (status === 2) variant = "default"   // Received
        if (status === 3) variant = "destructive" // Cancelled

        return <Badge variant={variant}>{label}</Badge>
      }
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => <div className="text-right">Total</div>,
      cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.getValue("totalAmount"))}</div>
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const status = row.original.status
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
              <DropdownMenuItem onClick={() => router.push(`/dashboard/purchases/orders/${row.original.id}`)}>
                <Eye className="mr-2 h-4 w-4" /> View Details
              </DropdownMenuItem>

              {status === 0 && (
                <>
                  <DropdownMenuItem onClick={() => handleApprove(row.original.id)}>
                    <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" /> Approve
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(row.original.id)}>
                    <Trash className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}

              {status === 1 && (
                <DropdownMenuItem onClick={() => handleReceive(row.original.id)}>
                  <Package className="mr-2 h-4 w-4 text-blue-600" /> Receive Items
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

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
          <h2 className="text-3xl font-bold tracking-tight text-gradient">Purchase Orders</h2>
          <p className="text-muted-foreground">Manage orders to vendors.</p>
        </div>
        <Link href="/dashboard/purchases/orders/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> New Order
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        filterColumn="orderNumber"
        filterPlaceholder="Search orders..."
      />
    </div>
  )
}
