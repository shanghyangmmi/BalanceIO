"use client";

import { InvoiceData, TemplateConfig, defaultTemplateConfig } from '../types';
import { formatCurrency, formatDate } from '@/lib/format';

interface ClassicTemplateProps {
    invoice: InvoiceData;
    config?: Partial<TemplateConfig>;
}

/**
 * Classic Invoice Template
 * Traditional business invoice with clear sections and professional layout.
 */
export function ClassicTemplate({ invoice, config }: ClassicTemplateProps) {
    const cfg = { ...defaultTemplateConfig, ...config };

    return (
        <div
            className="bg-white text-zinc-900 p-8 max-w-[210mm] mx-auto shadow-lg print:shadow-none"
            style={{ fontFamily: cfg.fontFamily }}
        >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 pb-6 mb-6" style={{ borderColor: cfg.primaryColor }}>
                <div>
                    {cfg.showLogo && invoice.company.logo ? (
                        <img src={invoice.company.logo} alt={invoice.company.name} className="h-16 mb-4" />
                    ) : (
                        <h1 className="text-2xl font-bold mb-2" style={{ color: cfg.primaryColor }}>
                            {invoice.company.name}
                        </h1>
                    )}
                    <p className="text-sm text-zinc-600 whitespace-pre-line">{invoice.company.address}</p>
                    {invoice.company.phone && <p className="text-sm text-zinc-600">{invoice.company.phone}</p>}
                    {invoice.company.email && <p className="text-sm text-zinc-600">{invoice.company.email}</p>}
                    {cfg.showTaxId && invoice.company.taxId && (
                        <p className="text-sm text-zinc-600 mt-1">NPWP: {invoice.company.taxId}</p>
                    )}
                </div>
                <div className="text-right">
                    <h2 className="text-3xl font-bold mb-4" style={{ color: cfg.primaryColor }}>INVOICE</h2>
                    <div className="space-y-1 text-sm">
                        <p><span className="text-zinc-500">Invoice #:</span> <strong>{invoice.invoiceNumber}</strong></p>
                        <p><span className="text-zinc-500">Date:</span> {formatDate(invoice.invoiceDate)}</p>
                        <p><span className="text-zinc-500">Due Date:</span> {formatDate(invoice.dueDate)}</p>
                        {invoice.referenceNumber && (
                            <p><span className="text-zinc-500">Ref:</span> {invoice.referenceNumber}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Bill To */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bill To</h3>
                <div className="bg-zinc-50 p-4 rounded-lg">
                    <p className="font-semibold text-lg">{invoice.customer.name}</p>
                    {invoice.customer.address && (
                        <p className="text-sm text-zinc-600 whitespace-pre-line mt-1">{invoice.customer.address}</p>
                    )}
                    {invoice.customer.email && <p className="text-sm text-zinc-600">{invoice.customer.email}</p>}
                    {cfg.showTaxId && invoice.customer.taxId && (
                        <p className="text-sm text-zinc-600">NPWP: {invoice.customer.taxId}</p>
                    )}
                </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full mb-8">
                <thead>
                    <tr style={{ backgroundColor: cfg.primaryColor }} className="text-white">
                        <th className="py-3 px-4 text-left text-sm font-semibold">#</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold">Description</th>
                        <th className="py-3 px-4 text-center text-sm font-semibold">Qty</th>
                        <th className="py-3 px-4 text-right text-sm font-semibold">Unit Price</th>
                        <th className="py-3 px-4 text-right text-sm font-semibold">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((item, index) => (
                        <tr key={item.lineNumber} className={index % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                            <td className="py-3 px-4 text-sm text-zinc-600">{item.lineNumber}</td>
                            <td className="py-3 px-4 text-sm">
                                {item.description}
                                {item.discountAmount > 0 && (
                                    <span className="text-xs text-emerald-600 ml-2">
                                        (-{item.discountPercent}%)
                                    </span>
                                )}
                            </td>
                            <td className="py-3 px-4 text-sm text-center">{item.quantity} {item.unit}</td>
                            <td className="py-3 px-4 text-sm text-right">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                            <td className="py-3 px-4 text-sm text-right font-medium">{formatCurrency(item.lineTotal - item.taxAmount, invoice.currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
                <div className="w-72">
                    <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600">Subtotal</span>
                        <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                        <div className="flex justify-between py-2 border-b text-emerald-600">
                            <span>Discount</span>
                            <span>-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
                        </div>
                    )}
                    {invoice.subtotalDpp && invoice.subtotalDpp !== invoice.subtotal && (
                        <div className="flex justify-between py-1.5 border-b text-xs text-zinc-500">
                            <span>DPP (11/12 Nilai Lain)</span>
                            <span className="font-mono">{formatCurrency(invoice.subtotalDpp, invoice.currency)}</span>
                        </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600">PPN ({invoice.taxRate ?? 12}%)</span>
                        <span className="font-medium">{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                    </div>
                    {invoice.ppnbmAmount && invoice.ppnbmAmount > 0 && (
                        <div className="flex justify-between py-2 border-b text-amber-700 dark:text-amber-400">
                            <span>PPnBM (Luxury Tax)</span>
                            <span className="font-medium">{formatCurrency(invoice.ppnbmAmount, invoice.currency)}</span>
                        </div>
                    )}
                    <div className="flex justify-between py-3 text-lg font-bold" style={{ color: cfg.primaryColor }}>
                        <span>Total</span>
                        <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                    </div>
                    {invoice.amountPaid > 0 && (
                        <>
                            <div className="flex justify-between py-2 border-t">
                                <span className="text-zinc-600">Amount Paid</span>
                                <span className="text-emerald-600">-{formatCurrency(invoice.amountPaid, invoice.currency)}</span>
                            </div>
                            <div className="flex justify-between py-2 font-bold text-red-600">
                                <span>Amount Due</span>
                                <span>{formatCurrency(invoice.amountDue, invoice.currency)}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Notes & Terms */}
            <div className="grid grid-cols-2 gap-6 border-t pt-6">
                {cfg.showNotes && invoice.notes && (
                    <div>
                        <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Notes</h4>
                        <p className="text-sm text-zinc-600">{invoice.notes}</p>
                    </div>
                )}
                {cfg.showTerms && invoice.terms && (
                    <div>
                        <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Terms & Conditions</h4>
                        <p className="text-sm text-zinc-600">{invoice.terms}</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-center text-xs text-zinc-400">
                <p>Thank you for your business!</p>
            </div>
        </div>
    );
}
