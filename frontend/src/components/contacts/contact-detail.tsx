"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { minorToNumber, sumMinor } from "@/lib/utils/minor-units"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/components/auth/rbac-guard"
import { useCompany } from "@/contexts/company-context"
import { Figure, SectionHeading, formatIsoDate } from "@/components/dashboard/module/module-primitives"

interface ApiContact {
  id: string
  code: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  taxId: string | null
  isCustomer: boolean
  isVendor: boolean
  isEmployee: boolean
}

interface ContactSummary {
  receivableOutstanding: number
  invoicedThisYear: number
  invoiceCount: number
  payableOutstanding: number
  billedThisYear: number
  billCount: number
}

interface DocumentRow {
  id: string
  number: string
  date: string
  dueDate: string
  status: number
  total: number
  amountPaid: number
}

const INVOICE_STATUS = ["Draft", "Sent", "Partially paid", "Paid", "Overdue", "Void"]
const BILL_STATUS = ["Draft", "Pending", "Posted", "Partially paid", "Paid", "Void"]

/**
 * One contact, from the API: identity, what each side owes, and the
 * invoices and bills behind it. Replaces three detail pages that rendered
 * static sample data whatever id they were given.
 */
export function ContactDetail() {
  const id = useSearchParams().get("id")
  const { company } = useCompany()
  const can = useCan()
  const ready = !!company && !!id

  const contact = useQuery({
    queryKey: ["contact", company?.id, id],
    queryFn: () => apiClient.get<ApiContact>(`/Contacts/${id}`),
    enabled: ready,
    retry: retryUnlessClientError,
  })
  const summary = useQuery({
    queryKey: ["contact-summary", company?.id, id],
    queryFn: () => apiClient.get<ContactSummary>(`/Contacts/${id}/summary`),
    enabled: ready,
    retry: retryUnlessClientError,
  })
  const showInvoices = can(PERMISSIONS.SalesView) && !!contact.data?.isCustomer
  const showBills = can(PERMISSIONS.PurchasesView) && !!contact.data?.isVendor
  const invoices = useQuery({
    queryKey: ["contact-invoices", company?.id, id],
    queryFn: async () =>
      (await apiClient.get<{ id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; status: number; total: number; amountPaid: number }[]>(`/SalesInvoices?contactId=${id}`))
        .map((i): DocumentRow => ({ id: i.id, number: i.invoiceNumber, date: i.invoiceDate, dueDate: i.dueDate, status: i.status, total: i.total, amountPaid: i.amountPaid })),
    enabled: ready && showInvoices,
    retry: retryUnlessClientError,
  })
  const bills = useQuery({
    queryKey: ["contact-bills", company?.id, id],
    queryFn: async () =>
      (await apiClient.get<{ id: string; billNumber: string; billDate: string; dueDate: string; status: number; total: number; amountPaid: number }[]>(`/PurchaseBills?contactId=${id}`))
        .map((b): DocumentRow => ({ id: b.id, number: b.billNumber, date: b.billDate, dueDate: b.dueDate, status: b.status, total: b.total, amountPaid: b.amountPaid })),
    enabled: ready && showBills,
    retry: retryUnlessClientError,
  })

  if (!id) return <p className="text-sm text-muted-foreground">No contact selected.</p>
  if (contact.isError) return <p className="text-sm text-muted-foreground">{contact.error instanceof Error ? contact.error.message : "Contact not found."}</p>
  if (contact.isPending) return <Skeleton className="h-40 w-full" />

  const c = contact.data
  const money = (v: number) => formatModuleMoney(v, "IDR")
  const roles = [c.isCustomer && "Customer", c.isVendor && "Vendor", c.isEmployee && "Employee"].filter(Boolean).join(" · ")

  return (
    <div className="flex-1 space-y-8">
      <header className="space-y-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{roles || "Contact"}</span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{c.name}</h1>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {c.code}
          {c.taxId && ` · NPWP ${c.taxId}`}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {[c.email, c.phone, [c.address, c.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No contact details recorded."}
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60">
        <div className="grid min-h-[104px] divide-y divide-foreground/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {summary.isPending ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3 p-5 sm:p-6"><Skeleton className="h-2 w-20" /><Skeleton className="h-7 w-28" /></div>
            ))
          ) : summary.isError ? (
            <p className="p-5 text-sm text-muted-foreground sm:col-span-4">Balances could not be loaded.</p>
          ) : (
            <>
              <Figure label="Receivable" value={money(summary.data.receivableOutstanding)} note="Owed to the company" />
              <Figure label="Invoiced this year" value={money(summary.data.invoicedThisYear)} note={`${summary.data.invoiceCount} invoices, incl. PPN`} />
              <Figure label="Payable" value={money(summary.data.payableOutstanding)} note="Owed by the company" />
              <Figure label="Billed this year" value={money(summary.data.billedThisYear)} note={`${summary.data.billCount} bills, incl. PPN`} />
            </>
          )}
        </div>
      </section>

      {showInvoices && (
        <Documents
          title="Sales invoices"
          rows={invoices.data}
          pending={invoices.isPending}
          statuses={INVOICE_STATUS}
          href={(row) => `/dashboard/sales/invoices/preview?id=${row.id}`}
          money={money}
        />
      )}
      {showBills && (
        <Documents title="Purchase bills" rows={bills.data} pending={bills.isPending} statuses={BILL_STATUS} money={money} />
      )}
    </div>
  )
}

function Documents({
  title,
  rows,
  pending,
  statuses,
  href,
  money,
}: {
  title: string
  rows: DocumentRow[] | undefined
  pending: boolean
  statuses: string[]
  href?: (row: DocumentRow) => string
  money: (v: number) => string
}) {
  return (
    <section className="space-y-5">
      <SectionHeading note={rows ? `${rows.length}` : undefined}>{title}</SectionHeading>
      <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60">
        <table className="w-full min-w-[640px] text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3 font-normal">Number</th>
              <th className="px-3 py-3 font-normal">Date</th>
              <th className="px-3 py-3 font-normal">Due</th>
              <th className="px-3 py-3 font-normal">Status</th>
              <th className="px-3 py-3 text-right font-normal">Total</th>
              <th className="px-5 py-3 text-right font-normal">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {pending ? (
              <tr><td colSpan={6} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td></tr>
            ) : !rows || rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-6 text-muted-foreground">None.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-foreground/10 first:border-t-0">
                  <td className="px-5 py-3 font-mono text-[12px]">
                    {href ? <Link href={href(r)} className="underline-offset-4 hover:underline">{r.number}</Link> : r.number}
                  </td>
                  <td className="px-3 py-3">{formatIsoDate(r.date)}</td>
                  <td className="px-3 py-3">{formatIsoDate(r.dueDate)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{statuses[r.status] ?? r.status}</td>
                  <td className="px-3 py-3 text-right">{money(r.total)}</td>
                  <td className="px-5 py-3 text-right text-foreground">{money(minorToNumber(sumMinor([r.total, -r.amountPaid])))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
