"use client";

import { InvoiceData, TemplateConfig, defaultTemplateConfig } from '../types';
import { formatCurrency, formatDate } from '@/lib/format';

interface MinimalTemplateProps {
    invoice: InvoiceData;
    config?: Partial<TemplateConfig>;
}

/**
 * Minimal Invoice Template
 * Clean, ultra-simple design with lots of whitespace and subtle typography.
 */
export function MinimalTemplate({ invoice, config }: MinimalTemplateProps) {
    const cfg = { ...defaultTemplateConfig, ...config };

    return (
        <div
            className="bg-white text-zinc-900 p-12 max-w-[210mm] mx-auto"
            style={{ fontFamily: cfg.fontFamily }}
        >
            {/* Header - Ultra Simple */}
            <div className="flex justify-between items-start mb-16">
                <div>
                    <h1 className="text-xl font-medium text-zinc-400 tracking-widest uppercase mb-8">Invoice</h1>
                    {cfg.showLogo && invoice.company.logo ? (
                        <img src={invoice.company.logo} alt={invoice.company.name} className="h-8" />
                    ) : (
                        <p className="font-medium">{invoice.company.name}</p>
                    )}
                </div>
                <div className="text-right text-sm text-zinc-500">
                    <p className="font-mono text-lg text-zinc-900 mb-2">{invoice.invoiceNumber}</p>
                    <p>{formatDate(invoice.invoiceDate)}</p>
                </div>
            </div>

            {/* Addresses - Side by Side */}
            <div className="grid grid-cols-2 gap-16 mb-16">
                <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">From</p>
                    <p className="font-medium">{invoice.company.name}</p>
                    <p className="text-sm text-zinc-500 whitespace-pre-line mt-1">{invoice.company.address}</p>
                </div>
                <div>
                    <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">To</p>
                    <p className="font-medium">{invoice.customer.name}</p>
                    {invoice.customer.address && (
                        <p className="text-sm text-zinc-500 whitespace-pre-line mt-1">{invoice.customer.address}</p>
                    )}
                </div>
            </div>

            {/* Line Items - Simple List */}
            <div className="mb-16">
                <div className="border-b border-zinc-200 pb-2 mb-4 flex justify-between text-xs text-zinc-400 uppercase tracking-widest">
                    <span>Description</span>
                    <span>Amount</span>
                </div>
                <div className="space-y-4">
                    {invoice.items.map((item) => (
                        <div key={item.lineNumber} className="flex justify-between items-baseline">
                            <div>
                                <p>{item.description}</p>
                                <p className="text-sm text-zinc-400 mt-0.5">
                                    {item.quantity} × {formatCurrency(item.unitPrice, invoice.currency)}
                                </p>
                            </div>
                            <p className="font-medium tabular-nums">
                                {formatCurrency(item.lineTotal - item.taxAmount, invoice.currency)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Totals - Right Aligned */}
            <div className="flex justify-end mb-16">
                <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Subtotal</span>
                        <span className="tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Discount</span>
                            <span className="tabular-nums text-emerald-600">-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Tax</span>
                        <span className="tabular-nums">{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between pt-4 border-t border-zinc-900">
                        <span className="font-medium">Total</span>
                        <span className="font-medium text-lg tabular-nums">{formatCurrency(invoice.total, invoice.currency)}</span>
                    </div>
                </div>
            </div>

            {/* Due Date */}
            <div className="text-center py-6 border-t border-b border-zinc-100 mb-12">
                <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Payment Due</p>
                <p className="font-medium">{formatDate(invoice.dueDate)}</p>
            </div>

            {/* Notes */}
            {cfg.showNotes && invoice.notes && (
                <div className="text-center">
                    <p className="text-sm text-zinc-500">{invoice.notes}</p>
                </div>
            )}
        </div>
    );
}
