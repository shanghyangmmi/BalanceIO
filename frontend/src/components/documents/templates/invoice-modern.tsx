"use client";

import { InvoiceData, TemplateConfig, defaultTemplateConfig } from '../types';
import { formatCurrency, formatDate } from '@/lib/format';

interface ModernTemplateProps {
    invoice: InvoiceData;
    config?: Partial<TemplateConfig>;
}

/**
 * Modern Invoice Template
 * Contemporary design with gradient accents, rounded corners, and card-based layout.
 */
export function ModernTemplate({ invoice, config }: ModernTemplateProps) {
    const cfg = { ...defaultTemplateConfig, ...config };

    return (
        <div
            className="bg-zinc-50 text-zinc-900 max-w-[210mm] mx-auto print:bg-white"
            style={{ fontFamily: cfg.fontFamily }}
        >
            {/* Header with Gradient */}
            <div
                className="p-8 text-white rounded-b-3xl"
                style={{ background: `linear-gradient(135deg, ${cfg.primaryColor} 0%, ${cfg.secondaryColor} 100%)` }}
            >
                <div className="flex justify-between items-start">
                    <div>
                        {cfg.showLogo && invoice.company.logo ? (
                            <img src={invoice.company.logo} alt={invoice.company.name} className="h-12 mb-4 brightness-0 invert" />
                        ) : (
                            <h1 className="text-2xl font-bold mb-2">{invoice.company.name}</h1>
                        )}
                        <p className="text-sm text-white/80 whitespace-pre-line">{invoice.company.address}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-black tracking-tight mb-2">INVOICE</div>
                        <div className="text-lg font-semibold">{invoice.invoiceNumber}</div>
                    </div>
                </div>
            </div>

            <div className="p-8 -mt-8">
                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {/* Customer Card */}
                    <div className="col-span-2 bg-white rounded-2xl shadow-lg p-6">
                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Billed To</h3>
                        <p className="font-bold text-lg" style={{ color: cfg.primaryColor }}>{invoice.customer.name}</p>
                        {invoice.customer.address && (
                            <p className="text-sm text-zinc-600 whitespace-pre-line mt-2">{invoice.customer.address}</p>
                        )}
                        {invoice.customer.email && <p className="text-sm text-zinc-500 mt-1">{invoice.customer.email}</p>}
                    </div>

                    {/* Date Card */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="mb-4">
                            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Invoice Date</h3>
                            <p className="font-semibold">{formatDate(invoice.invoiceDate)}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Due Date</h3>
                            <p className="font-semibold text-red-500">{formatDate(invoice.dueDate)}</p>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
                    <div className="p-6 border-b border-zinc-100">
                        <h3 className="font-semibold" style={{ color: cfg.primaryColor }}>Items</h3>
                    </div>
                    <div className="divide-y divide-zinc-100">
                        {invoice.items.map((item) => (
                            <div key={item.lineNumber} className="p-6 flex justify-between items-center hover:bg-zinc-50 transition-colors">
                                <div className="flex-1">
                                    <p className="font-medium">{item.description}</p>
                                    <p className="text-sm text-zinc-500 mt-1">
                                        {item.quantity} {item.unit} × {formatCurrency(item.unitPrice, invoice.currency)}
                                        {item.discountAmount > 0 && (
                                            <span className="text-emerald-600 ml-2">(-{item.discountPercent}%)</span>
                                        )}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">{formatCurrency(item.lineTotal - item.taxAmount, invoice.currency)}</p>
                                    {item.taxAmount > 0 && (
                                        <p className="text-xs text-zinc-400">+{formatCurrency(item.taxAmount, invoice.currency)} tax</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Totals Card */}
                <div className="flex justify-end mb-8">
                    <div className="bg-white rounded-2xl shadow-lg p-6 w-80">
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">Subtotal</span>
                                <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                            </div>
                            {invoice.discountAmount > 0 && (
                                <div className="flex justify-between text-sm text-emerald-600">
                                    <span>Discount</span>
                                    <span>-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">Tax (PPN)</span>
                                <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between">
                                <span className="font-bold text-lg">Total</span>
                                <span className="font-bold text-xl" style={{ color: cfg.primaryColor }}>
                                    {formatCurrency(invoice.total, invoice.currency)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Notes */}
                {(cfg.showNotes && invoice.notes) || (cfg.showTerms && invoice.terms) ? (
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="grid grid-cols-2 gap-6">
                            {cfg.showNotes && invoice.notes && (
                                <div>
                                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Notes</h4>
                                    <p className="text-sm text-zinc-600">{invoice.notes}</p>
                                </div>
                            )}
                            {cfg.showTerms && invoice.terms && (
                                <div>
                                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Terms</h4>
                                    <p className="text-sm text-zinc-600">{invoice.terms}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
