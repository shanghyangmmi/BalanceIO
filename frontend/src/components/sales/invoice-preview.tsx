"use client"

import { SalesInvoice } from "@/lib/types/sales";
import { formatCurrency, formatDate } from "@/lib/utils/formatter";
import { Button } from "@/components/ui/button";
import { Printer, Send, Wallet, Download } from "lucide-react";
import { useCompanyData } from "@/hooks/use-company-data";
import { useRef } from "react";

interface InvoicePreviewProps {
    invoice: SalesInvoice;
}

export function InvoicePreview({ invoice }: InvoicePreviewProps) {
    const { company } = useCompanyData();

    return (
        <div className="bg-white p-8 rounded shadow-sm border border-zinc-200 min-h-[800px] text-sm print:shadow-none print:border-none">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">INVOICE</h1>
                    <p className="text-muted-foreground font-mono mt-1">#{invoice.invoiceNumber}</p>
                    <div className="mt-2 text-xs text-zinc-500 uppercase tracking-widest">{invoice.status}</div>
                </div>
                <div className="text-right">
                    <h2 className="font-bold text-lg">{company.name}</h2>
                    <p className="text-zinc-500 whitespace-pre-line">{company.address}</p>
                    <p className="text-zinc-500">{company.city || "Jakarta"}, {company.country || "Indonesia"}</p>
                    {(company.phone || company.email) && (
                        <p className="text-zinc-400 text-xs mt-1">
                            {company.phone && <span>{company.phone}</span>}
                            {company.phone && company.email && <span className="mx-1">•</span>}
                            {company.email && <span>{company.email}</span>}
                        </p>
                    )}
                </div>
            </div>

            {/* Bill To & Dates */}
            <div className="flex justify-between mb-8">
                <div>
                    <h3 className="text-zinc-500 font-semibold text-xs uppercase mb-1">Bill To</h3>
                    <p className="font-bold text-lg">{invoice.contactName}</p>
                    <p className="text-zinc-500">{invoice.billingAddress || "No Address Provided"}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-8 text-right">
                    <div>
                        <h3 className="text-zinc-500 font-semibold text-xs uppercase mb-1">Date</h3>
                        <p>{formatDate(invoice.invoiceDate)}</p>
                    </div>
                    <div>
                        <h3 className="text-zinc-500 font-semibold text-xs uppercase mb-1">Due Date</h3>
                        <p>{formatDate(invoice.dueDate)}</p>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <table className="w-full mb-8">
                <thead>
                    <tr className="border-b border-zinc-900">
                        <th className="text-left font-semibold py-2">Description</th>
                        <th className="text-right font-semibold py-2 w-[100px]">Qty</th>
                        <th className="text-right font-semibold py-2 w-[150px]">Unit Price</th>
                        <th className="text-right font-semibold py-2 w-[100px]">Disc.</th>
                        <th className="text-right font-semibold py-2 w-[150px]">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.lines.map((item) => (
                        <tr key={item.id} className="border-b border-zinc-100">
                            <td className="py-4 text-zinc-700">
                                <p className="font-medium">{item.description}</p>
                                {item.productName && item.productName !== item.description && (
                                    <p className="text-xs text-zinc-400">{item.productName}</p>
                                )}
                            </td>
                            <td className="py-4 text-right text-zinc-500">{item.quantity}</td>
                            <td className="py-4 text-right text-zinc-500">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                            <td className="py-4 text-right text-zinc-500">{item.discountAmount > 0 ? formatCurrency(item.discountAmount, invoice.currency) : '-'}</td>
                            <td className="py-4 text-right font-medium">{formatCurrency(item.lineTotal, invoice.currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-[300px] space-y-2">
                    <div className="flex justify-between text-zinc-500">
                        <span>Subtotal</span>
                        <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                        <span>Tax</span>
                        <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-4 border-t border-zinc-200 mt-4">
                        <span>Total</span>
                        <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-zinc-100 text-center text-zinc-400 text-xs">
                <p>Payment is due within 30 days.</p>
                <p>Thank you for your business.</p>
            </div>

            <div className="flex gap-2 print:hidden justify-end mt-8">
                <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
            </div>
        </div>
    )
}
