"use client";

import { InvoiceData, TemplateConfig, defaultTemplateConfig } from '../types';
import { formatCurrency, formatDate } from '@/lib/format';

interface BoldTemplateProps {
    invoice: InvoiceData;
    config?: Partial<TemplateConfig>;
}

/**
 * Bold Invoice Template
 * High-contrast design with strong typography and dark accents.
 */
export function BoldTemplate({ invoice, config }: BoldTemplateProps) {
    const cfg = { ...defaultTemplateConfig, ...config };

    return (
        <div
            className="bg-white text-zinc-900 max-w-[210mm] mx-auto"
            style={{ fontFamily: cfg.fontFamily }}
        >
            {/* Header - Dark Band */}
            <div className="bg-zinc-900 text-white p-8">
                <div className="flex justify-between items-center">
                    <div>
                        {cfg.showLogo && invoice.company.logo ? (
                            <img src={invoice.company.logo} alt={invoice.company.name} className="h-10 brightness-0 invert" />
                        ) : (
                            <h1 className="text-2xl font-black">{invoice.company.name}</h1>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="text-5xl font-black" style={{ color: cfg.secondaryColor }}>
                            {invoice.invoiceNumber}
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice Label */}
            <div className="py-4 px-8 bg-zinc-100 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Invoice</span>
                <div className="flex gap-8 text-sm">
                    <div>
                        <span className="text-zinc-400">Date: </span>
                        <span className="font-bold">{formatDate(invoice.invoiceDate)}</span>
                    </div>
                    <div>
                        <span className="text-zinc-400">Due: </span>
                        <span className="font-bold text-red-600">{formatDate(invoice.dueDate)}</span>
                    </div>
                </div>
            </div>

            <div className="p-8">
                {/* Addresses */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="p-6 border-l-4" style={{ borderColor: cfg.primaryColor, backgroundColor: `${cfg.primaryColor}08` }}>
                        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: cfg.primaryColor }}>From</h3>
                        <p className="font-bold text-lg">{invoice.company.name}</p>
                        <p className="text-sm text-zinc-600 whitespace-pre-line mt-2">{invoice.company.address}</p>
                        {cfg.showTaxId && invoice.company.taxId && (
                            <p className="text-sm text-zinc-500 mt-2">NPWP: {invoice.company.taxId}</p>
                        )}
                    </div>
                    <div className="p-6 border-l-4 border-zinc-300 bg-zinc-50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Bill To</h3>
                        <p className="font-bold text-lg">{invoice.customer.name}</p>
                        {invoice.customer.address && (
                            <p className="text-sm text-zinc-600 whitespace-pre-line mt-2">{invoice.customer.address}</p>
                        )}
                        {cfg.showTaxId && invoice.customer.taxId && (
                            <p className="text-sm text-zinc-500 mt-2">NPWP: {invoice.customer.taxId}</p>
                        )}
                    </div>
                </div>

                {/* Line Items */}
                <div className="mb-8">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-zinc-900">
                                <th className="py-4 text-left text-xs font-bold uppercase tracking-wider">Item</th>
                                <th className="py-4 text-center text-xs font-bold uppercase tracking-wider">Qty</th>
                                <th className="py-4 text-right text-xs font-bold uppercase tracking-wider">Rate</th>
                                <th className="py-4 text-right text-xs font-bold uppercase tracking-wider">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item, index) => (
                                <tr key={item.lineNumber} className="border-b border-zinc-200">
                                    <td className="py-4">
                                        <p className="font-medium">{item.description}</p>
                                        {item.discountAmount > 0 && (
                                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                                {item.discountPercent}% off
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 text-center">
                                        <span className="font-bold">{item.quantity}</span>
                                        <span className="text-zinc-400 text-sm ml-1">{item.unit}</span>
                                    </td>
                                    <td className="py-4 text-right tabular-nums">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                                    <td className="py-4 text-right font-bold tabular-nums">{formatCurrency(item.lineTotal - item.taxAmount, invoice.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                    <div className="w-80">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between py-2">
                                <span>Subtotal</span>
                                <span className="font-medium tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                            </div>
                            {invoice.discountAmount > 0 && (
                                <div className="flex justify-between py-2 text-emerald-600">
                                    <span>Discount</span>
                                    <span className="font-medium tabular-nums">-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-2">
                                <span>Tax (PPN {invoice.taxRate}%)</span>
                                <span className="font-medium tabular-nums">{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                            </div>
                        </div>
                        <div
                            className="flex justify-between py-4 mt-2 text-white text-xl font-bold"
                            style={{ backgroundColor: cfg.primaryColor }}
                        >
                            <span className="px-4">TOTAL</span>
                            <span className="px-4 tabular-nums">{formatCurrency(invoice.total, invoice.currency)}</span>
                        </div>
                    </div>
                </div>

                {/* Notes & Terms */}
                {(cfg.showNotes && invoice.notes) || (cfg.showTerms && invoice.terms) ? (
                    <div className="border-t-2 border-zinc-900 pt-6 grid grid-cols-2 gap-8">
                        {cfg.showNotes && invoice.notes && (
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Notes</h4>
                                <p className="text-sm text-zinc-600">{invoice.notes}</p>
                            </div>
                        )}
                        {cfg.showTerms && invoice.terms && (
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Terms</h4>
                                <p className="text-sm text-zinc-600">{invoice.terms}</p>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
