"use client";

import { InvoiceData, TemplateConfig, defaultTemplateConfig } from '../types';
import { formatCurrency, formatDate } from '@/lib/format';

interface ElegantTemplateProps {
    invoice: InvoiceData;
    config?: Partial<TemplateConfig>;
}

/**
 * Elegant Invoice Template
 * Sophisticated design with serif typography, gold accents, and refined details.
 */
export function ElegantTemplate({ invoice, config }: ElegantTemplateProps) {
    const cfg = { ...defaultTemplateConfig, ...config };
    const accentColor = cfg.secondaryColor || '#B8860B'; // Default to gold
    const serifFont = "var(--font-document-serif, 'Merriweather', Georgia, serif)";

    return (
        <div
            className="bg-white text-zinc-800 max-w-[210mm] mx-auto"
            style={{ fontFamily: serifFont }}
        >
            {/* Decorative Top Border */}
            <div className="h-2" style={{ background: `linear-gradient(90deg, ${cfg.primaryColor}, ${accentColor}, ${cfg.primaryColor})` }} />

            <div className="p-10">
                {/* Header */}
                <div className="text-center mb-12 pb-8 border-b border-zinc-200">
                    {cfg.showLogo && invoice.company.logo ? (
                        <img src={invoice.company.logo} alt={invoice.company.name} className="h-16 mx-auto mb-4" />
                    ) : (
                        <h1 className="text-3xl font-normal tracking-wide mb-2" style={{ color: cfg.primaryColor }}>
                            {invoice.company.name}
                        </h1>
                    )}
                    <p className="text-sm text-zinc-500 italic">{invoice.company.address?.split('\n')[0]}</p>
                    <div className="mt-6">
                        <span
                            className="inline-block px-6 py-2 text-xs uppercase tracking-[0.3em] border-2"
                            style={{ borderColor: accentColor, color: accentColor }}
                        >
                            Invoice
                        </span>
                    </div>
                </div>

                {/* Invoice Info */}
                <div className="flex justify-center gap-16 mb-12 text-sm">
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-zinc-400 mb-1">Invoice No.</p>
                        <p className="font-semibold" style={{ fontFamily: cfg.fontFamily }}>{invoice.invoiceNumber}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-zinc-400 mb-1">Date</p>
                        <p>{formatDate(invoice.invoiceDate)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-zinc-400 mb-1">Due Date</p>
                        <p>{formatDate(invoice.dueDate)}</p>
                    </div>
                </div>

                {/* Addresses */}
                <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                        <h3 className="text-xs uppercase tracking-wider mb-4" style={{ color: accentColor }}>From</h3>
                        <p className="font-semibold text-lg mb-2">{invoice.company.name}</p>
                        <p className="text-sm text-zinc-600 whitespace-pre-line leading-relaxed">{invoice.company.address}</p>
                        {invoice.company.email && <p className="text-sm text-zinc-500 mt-2 italic">{invoice.company.email}</p>}
                    </div>
                    <div>
                        <h3 className="text-xs uppercase tracking-wider mb-4" style={{ color: accentColor }}>To</h3>
                        <p className="font-semibold text-lg mb-2">{invoice.customer.name}</p>
                        {invoice.customer.address && (
                            <p className="text-sm text-zinc-600 whitespace-pre-line leading-relaxed">{invoice.customer.address}</p>
                        )}
                        {invoice.customer.email && <p className="text-sm text-zinc-500 mt-2 italic">{invoice.customer.email}</p>}
                    </div>
                </div>

                {/* Decorative Divider */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="flex-1 h-px bg-zinc-200" />
                    <div className="w-2 h-2 rotate-45" style={{ backgroundColor: accentColor }} />
                    <div className="flex-1 h-px bg-zinc-200" />
                </div>

                {/* Line Items */}
                <div className="mb-12">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-300">
                                <th className="py-3 text-left text-xs uppercase tracking-wider text-zinc-500">Description</th>
                                <th className="py-3 text-center text-xs uppercase tracking-wider text-zinc-500">Quantity</th>
                                <th className="py-3 text-right text-xs uppercase tracking-wider text-zinc-500">Rate</th>
                                <th className="py-3 text-right text-xs uppercase tracking-wider text-zinc-500">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item) => (
                                <tr key={item.lineNumber} className="border-b border-zinc-100">
                                    <td className="py-4">
                                        <p className="font-medium">{item.description}</p>
                                        {item.discountAmount > 0 && (
                                            <p className="text-xs italic" style={{ color: accentColor }}>
                                                Includes {item.discountPercent}% discount
                                            </p>
                                        )}
                                    </td>
                                    <td className="py-4 text-center" style={{ fontFamily: cfg.fontFamily }}>
                                        {item.quantity} {item.unit}
                                    </td>
                                    <td className="py-4 text-right tabular-nums" style={{ fontFamily: cfg.fontFamily }}>
                                        {formatCurrency(item.unitPrice, invoice.currency)}
                                    </td>
                                    <td className="py-4 text-right font-semibold tabular-nums" style={{ fontFamily: cfg.fontFamily }}>
                                        {formatCurrency(item.lineTotal - item.taxAmount, invoice.currency)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-12">
                    <div className="w-72">
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Subtotal</span>
                                <span style={{ fontFamily: cfg.fontFamily }}>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                            </div>
                            {invoice.discountAmount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Discount</span>
                                    <span className="text-emerald-600" style={{ fontFamily: cfg.fontFamily }}>
                                        -{formatCurrency(invoice.discountAmount, invoice.currency)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Tax</span>
                                <span style={{ fontFamily: cfg.fontFamily }}>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                            </div>
                            <div className="pt-3 border-t-2 flex justify-between text-lg" style={{ borderColor: accentColor }}>
                                <span className="font-semibold">Total Due</span>
                                <span className="font-bold" style={{ fontFamily: cfg.fontFamily, color: cfg.primaryColor }}>
                                    {formatCurrency(invoice.total, invoice.currency)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {cfg.showNotes && invoice.notes && (
                    <div className="text-center py-6 border-t border-zinc-200">
                        <p className="text-sm italic text-zinc-500">{invoice.notes}</p>
                    </div>
                )}

                {/* Terms */}
                {cfg.showTerms && invoice.terms && (
                    <div className="mt-8 p-6 bg-zinc-50 rounded text-center">
                        <h4 className="text-xs uppercase tracking-wider mb-2" style={{ color: accentColor }}>Payment Terms</h4>
                        <p className="text-sm text-zinc-600">{invoice.terms}</p>
                    </div>
                )}
            </div>

            {/* Decorative Bottom Border */}
            <div className="h-2" style={{ background: `linear-gradient(90deg, ${cfg.primaryColor}, ${accentColor}, ${cfg.primaryColor})` }} />
        </div>
    );
}
