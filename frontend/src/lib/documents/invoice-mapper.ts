import type { InvoiceData, InvoiceLineItem } from "@/components/documents/types"
import { minorToNumber, sumMinor } from "@/lib/utils/minor-units"

/** GET /api/SalesInvoices/{id}, as the API serialises it (enums as numbers). */
export interface ApiSalesInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  status: number
  currency: string
  billingAddress: string | null
  subtotal: number
  discountAmount: number
  discountPercent: number
  taxAmount: number
  total: number
  amountPaid: number
  referenceNumber: string | null
  notes: string | null
  terms: string | null
  contact: {
    name: string
    address: string | null
    city: string | null
    email: string | null
    phone: string | null
    taxId: string | null
  } | null
  lines: {
    lineNumber: number
    description: string
    quantity: number
    unit: string
    unitPrice: number
    discountAmount: number
    discountPercent: number
    taxRate: number
    dppScheme: number
    dppAmount: number
    taxAmount: number
    ppNBMAmount?: number
    pPnBMAmount?: number
    lineTotal: number
  }[]
}

export interface IssuerProfile {
  name: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  taxId?: string
  logoUrl?: string
}

const STATUS: InvoiceData["status"][] = ["draft", "sent", "sent", "paid", "overdue", "void"]
const SCHEMES: NonNullable<InvoiceLineItem["dppScheme"]>[] = ["NilaiLain11Over12", "Standard", "BesaranTertentu", "ZeroRated", "Exempt"]

/**
 * The stored invoice in the shape the print templates read. Every figure
 * is the one the server stored; the only arithmetic here is summing line
 * DPP and PPnBM, done in minor units.
 */
export function toInvoiceData(invoice: ApiSalesInvoice, issuer: IssuerProfile): InvoiceData {
  const lines = [...invoice.lines].sort((a, b) => a.lineNumber - b.lineNumber)
  const ppnbm = (l: ApiSalesInvoice["lines"][number]) => l.pPnBMAmount ?? l.ppNBMAmount ?? 0
  const customer = invoice.contact

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: STATUS[invoice.status] ?? "draft",
    company: {
      name: issuer.name,
      address: [issuer.address, [issuer.city, issuer.country].filter(Boolean).join(", ")].filter(Boolean).join("\n"),
      phone: issuer.phone,
      email: issuer.email,
      taxId: issuer.taxId,
      logo: issuer.logoUrl,
    },
    customer: {
      name: customer?.name ?? "",
      address: invoice.billingAddress ?? [customer?.address, customer?.city].filter(Boolean).join("\n"),
      email: customer?.email ?? undefined,
      phone: customer?.phone ?? undefined,
      taxId: customer?.taxId ?? undefined,
    },
    items: lines.map((l) => ({
      lineNumber: l.lineNumber,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
      dppScheme: SCHEMES[l.dppScheme],
      dppAmount: l.dppAmount,
      taxRate: l.taxRate,
      taxAmount: l.taxAmount,
      ppnbmAmount: ppnbm(l),
      lineTotal: l.lineTotal,
    })),
    subtotal: invoice.subtotal,
    subtotalDpp: minorToNumber(sumMinor(lines.map((l) => l.dppAmount))),
    discountPercent: invoice.discountPercent,
    discountAmount: invoice.discountAmount,
    taxAmount: invoice.taxAmount,
    ppnbmAmount: minorToNumber(sumMinor(lines.map(ppnbm))),
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    amountDue: minorToNumber(sumMinor([invoice.total, -invoice.amountPaid])),
    currency: invoice.currency,
    notes: invoice.notes ?? undefined,
    terms: invoice.terms ?? undefined,
    referenceNumber: invoice.referenceNumber ?? undefined,
  }
}
