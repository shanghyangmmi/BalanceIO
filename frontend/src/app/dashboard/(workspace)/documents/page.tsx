"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus,
  Loader2,
  FileText,
  Receipt,
  ShoppingCart,
  Eye,
  Search,
  Filter,
} from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface FinancialDocument {
  id: string
  type: "invoice" | "journal" | "purchase-order" | "purchase-bill"
  number: string
  date: string
  counterparty: string
  total: number
  status: string
}

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  posted: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
  draft: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  overdue: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  sent: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  void: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700",
}

const typeIcons: Record<string, React.ReactNode> = {
  invoice: <Receipt className="h-4 w-4 text-emerald-500" />,
  journal: <FileText className="h-4 w-4 text-cyan-500" />,
  "purchase-order": <ShoppingCart className="h-4 w-4 text-zinc-500" />,
  "purchase-bill": <FileText className="h-4 w-4 text-red-500" />,
}

const typeLabels: Record<string, string> = {
  invoice: "Sales Invoice",
  journal: "Journal Entry",
  "purchase-order": "Purchase Order",
  "purchase-bill": "Purchase Bill",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function DocumentsPage() {
    const can = useCan();
    const canCreateSales = can(PERMISSIONS.SalesCreate);
    const canCreateJournal = can(PERMISSIONS.FinanceCreate);
    const canCreatePurchases = can(PERMISSIONS.PurchasesCreate);
  const router = useRouter()
  const [documents, setDocuments] = useState<FinancialDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setIsLoading(true)

      // Fetch from all document sources in parallel
      const [invoices, journalEntries, purchaseOrders] = await Promise.allSettled([
        apiClient.getInvoices(),
        apiClient.getJournalEntries(),
        apiClient.getPurchaseOrders(),
      ])

      const docs: FinancialDocument[] = []

      // Map invoices
      if (invoices.status === "fulfilled" && Array.isArray(invoices.value)) {
        invoices.value.forEach((inv: any) => {
          docs.push({
            id: inv.id,
            type: "invoice",
            number: inv.invoiceNumber || `INV-${inv.id?.substring(0, 8)}`,
            date: inv.invoiceDate || inv.createdAt,
            counterparty: inv.contact?.name || inv.contactName || "—",
            total: inv.total || 0,
            status: (inv.status || "draft").toString().toLowerCase(),
          })
        })
      }

      // Map journal entries
      if (journalEntries.status === "fulfilled" && Array.isArray(journalEntries.value)) {
        journalEntries.value.forEach((je: any) => {
          docs.push({
            id: je.id,
            type: "journal",
            number: je.entryNumber || `JE-${je.id?.substring(0, 8)}`,
            date: je.entryDate || je.createdAt,
            counterparty: je.description || "—",
            total: je.totalDebit || je.total || 0,
            status: (je.status || "draft").toString().toLowerCase(),
          })
        })
      }

      // Map purchase orders
      if (purchaseOrders.status === "fulfilled" && Array.isArray(purchaseOrders.value)) {
        purchaseOrders.value.forEach((po: any) => {
          docs.push({
            id: po.id,
            type: "purchase-order",
            number: po.orderNumber || `PO-${po.id?.substring(0, 8)}`,
            date: po.orderDate || po.createdAt,
            counterparty: po.contact?.name || po.vendorName || "—",
            total: po.totalAmount || po.total || 0,
            status: (po.status || "draft").toString().toLowerCase(),
          })
        })
      }

      // Sort by date descending
      docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setDocuments(docs)
    } catch (error) {
      console.error("Failed to load documents", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchesFilter = filter === "all" || doc.type === filter
    const matchesSearch =
      searchQuery === "" ||
      doc.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.counterparty.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handleCreateDocument = (type: string) => {
    switch (type) {
      case "invoice":
        router.push("/dashboard/documents/new?type=sales-invoice")
        break
      case "journal":
        router.push("/dashboard/accounting/journal/new")
        break
      case "purchase-order":
        router.push("/dashboard/documents/new?type=purchase-order")
        break
      case "purchase-bill":
        router.push("/dashboard/documents/new?type=purchase-bill")
        break
    }
  }

  const handleViewDocument = (doc: FinancialDocument) => {
    router.push(`/dashboard/documents/${doc.id}`)
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Financial Documents</h2>
          <p className="text-muted-foreground">
            View and create invoices, journal entries, and purchase documents.
          </p>
        </div>
        {(canCreateSales || canCreateJournal || canCreatePurchases) && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Document
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canCreateSales && <>
            <DropdownMenuLabel>Sales</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleCreateDocument("invoice")}>
              <Receipt className="mr-2 h-4 w-4 text-emerald-500" />
              Sales Invoice
            </DropdownMenuItem>
            </>}
            {canCreateJournal && <>
            {canCreateSales && <DropdownMenuSeparator />}
            <DropdownMenuLabel>Accounting</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleCreateDocument("journal")}>
              <FileText className="mr-2 h-4 w-4 text-cyan-500" />
              Journal Entry
            </DropdownMenuItem>
            </>}
            {canCreatePurchases && <>
            {(canCreateSales || canCreateJournal) && <DropdownMenuSeparator />}
            <DropdownMenuLabel>Purchases</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleCreateDocument("purchase-order")}>
              <ShoppingCart className="mr-2 h-4 w-4 text-zinc-500" />
              Purchase Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCreateDocument("purchase-bill")}>
              <FileText className="mr-2 h-4 w-4 text-red-500" />
              Purchase Bill
            </DropdownMenuItem>
            </>}
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="invoice">Sales Invoices</SelectItem>
            <SelectItem value="journal">Journal Entries</SelectItem>
            <SelectItem value="purchase-order">Purchase Orders</SelectItem>
            <SelectItem value="purchase-bill">Purchase Bills</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Documents ({filteredDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                      {documents.length === 0
                        ? "No financial documents yet. Create your first document!"
                        : "No documents match your filter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => (
                    <TableRow
                      key={`${doc.type}-${doc.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDocument(doc)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {typeIcons[doc.type]}
                          <span>{doc.number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {typeLabels[doc.type] || doc.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {doc.date
                          ? format(new Date(doc.date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {doc.counterparty}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(doc.total)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[doc.status] || statusColors.draft}
                        >
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDocument(doc)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
