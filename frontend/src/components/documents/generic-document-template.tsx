"use client";

import { DocumentData, documentTypeConfig } from "./document-types";
import { formatCurrency, formatDate } from "@/lib/format";

interface GenericDocumentTemplateProps {
    document: DocumentData;
    variant?: "classic" | "modern" | "minimal";
}

/**
 * Generic Document Template
 * Renders any document type with appropriate layout based on document config
 */
export function GenericDocumentTemplate({
    document,
    variant = "classic",
}: GenericDocumentTemplateProps) {
    const config = documentTypeConfig[document.documentType];
    const primaryColor = config.color;

    const fmt = (amount: number) =>
        formatCurrency(amount, document.currency);

    return (
        <div
            className="bg-white w-[210mm] min-h-[297mm] mx-auto font-sans text-zinc-800 text-sm print:shadow-none"
            style={{ fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif" }}
        >
            {/* Header */}
            <div
                className="px-8 py-6"
                style={{ backgroundColor: primaryColor }}
            >
                <div className="flex justify-between items-start text-white">
                    <div>
                        <h1 className="text-2xl font-bold">{config.title}</h1>
                        <p className="text-white/80 mt-1">#{document.documentNumber}</p>
                    </div>
                    <div className="text-right">
                        <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center text-xl font-bold">
                            {config.titleShort}
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Info & Parties */}
            <div className="px-8 py-6 grid grid-cols-3 gap-6 border-b border-zinc-200">
                {/* Company */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">From</h3>
                    <p className="font-bold">{document.company.name}</p>
                    <p className="text-zinc-600 whitespace-pre-line text-xs mt-1">
                        {document.company.address}
                    </p>
                    {document.company.phone && (
                        <p className="text-xs text-zinc-500 mt-1">{document.company.phone}</p>
                    )}
                    {document.company.taxId && (
                        <p className="text-xs text-zinc-500">NPWP: {document.company.taxId}</p>
                    )}
                </div>

                {/* Counterparty */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">
                        {config.counterpartyLabel}
                    </h3>
                    <p className="font-bold">{document.counterparty.name}</p>
                    <p className="text-zinc-600 whitespace-pre-line text-xs mt-1">
                        {document.counterparty.address}
                    </p>
                    {document.counterparty.email && (
                        <p className="text-xs text-zinc-500 mt-1">{document.counterparty.email}</p>
                    )}
                </div>

                {/* Dates */}
                <div className="text-right">
                    <div className="space-y-2">
                        <div>
                            <p className="text-xs text-zinc-500">Date</p>
                            <p className="font-medium">{formatDate(document.documentDate)}</p>
                        </div>
                        {config.showDueDate && document.dueDate && (
                            <div>
                                <p className="text-xs text-zinc-500">Due Date</p>
                                <p className="font-medium">{formatDate(document.dueDate)}</p>
                            </div>
                        )}
                        {config.showDeliveryDate && document.deliveryDate && (
                            <div>
                                <p className="text-xs text-zinc-500">Delivery Date</p>
                                <p className="font-medium">{formatDate(document.deliveryDate)}</p>
                            </div>
                        )}
                        {document.referenceNumber && (
                            <div>
                                <p className="text-xs text-zinc-500">Reference</p>
                                <p className="font-medium">{document.referenceNumber}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Line Items Table */}
            {config.showItems && document.items && document.items.length > 0 && (
                <div className="px-8 py-6">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                                <th className="text-left py-2 text-xs font-bold text-zinc-500 uppercase">#</th>
                                <th className="text-left py-2 text-xs font-bold text-zinc-500 uppercase">Description</th>
                                <th className="text-right py-2 text-xs font-bold text-zinc-500 uppercase">Qty</th>
                                <th className="text-right py-2 text-xs font-bold text-zinc-500 uppercase">Unit Price</th>
                                {config.showTotals && (
                                    <th className="text-right py-2 text-xs font-bold text-zinc-500 uppercase">Amount</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {document.items.map((item) => (
                                <tr key={item.lineNumber} className="border-b border-zinc-100">
                                    <td className="py-3 text-zinc-500">{item.lineNumber}</td>
                                    <td className="py-3">
                                        <p className="font-medium">{item.description}</p>
                                        {item.itemCode && (
                                            <p className="text-xs text-zinc-500">Code: {item.itemCode}</p>
                                        )}
                                    </td>
                                    <td className="py-3 text-right">{item.quantity} {item.unit}</td>
                                    <td className="py-3 text-right font-mono">{fmt(item.unitPrice)}</td>
                                    {config.showTotals && (
                                        <td className="py-3 text-right font-mono font-medium">{fmt(item.lineTotal)}</td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Journal Entries Table */}
            {config.showJournalEntries && document.journalEntries && document.journalEntries.length > 0 && (
                <div className="px-8 py-6">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3">Journal Entries</h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                                <th className="text-left py-2 text-xs font-bold text-zinc-500 uppercase">Account</th>
                                <th className="text-left py-2 text-xs font-bold text-zinc-500 uppercase">Description</th>
                                <th className="text-right py-2 text-xs font-bold text-zinc-500 uppercase">Debit</th>
                                <th className="text-right py-2 text-xs font-bold text-zinc-500 uppercase">Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {document.journalEntries.map((entry) => (
                                <tr key={entry.lineNumber} className="border-b border-zinc-100">
                                    <td className="py-3">
                                        <span className="font-mono text-xs mr-2">{entry.accountCode}</span>
                                        <span className="font-medium">{entry.accountName}</span>
                                    </td>
                                    <td className="py-3 text-zinc-600">{entry.description}</td>
                                    <td className="py-3 text-right font-mono">{entry.debit > 0 ? fmt(entry.debit) : '-'}</td>
                                    <td className="py-3 text-right font-mono">{entry.credit > 0 ? fmt(entry.credit) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-bold" style={{ backgroundColor: `${primaryColor}10` }}>
                                <td colSpan={2} className="py-2 text-right">Total</td>
                                <td className="py-2 text-right font-mono">
                                    {fmt(document.journalEntries.reduce((sum, e) => sum + e.debit, 0))}
                                </td>
                                <td className="py-2 text-right font-mono">
                                    {fmt(document.journalEntries.reduce((sum, e) => sum + e.credit, 0))}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Totals */}
            {config.showTotals && (
                <div className="px-8 py-6 flex justify-end">
                    <div className="w-64 space-y-2">
                        {document.subtotal !== undefined && (
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">Subtotal</span>
                                <span className="font-mono">{fmt(document.subtotal)}</span>
                            </div>
                        )}
                        {document.discountAmount !== undefined && document.discountAmount > 0 && (
                            <div className="flex justify-between text-sm text-red-600">
                                <span>Discount</span>
                                <span className="font-mono">-{fmt(document.discountAmount)}</span>
                            </div>
                        )}
                        {document.taxAmount !== undefined && document.taxAmount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">Tax ({document.taxRate || 11}%)</span>
                                <span className="font-mono">{fmt(document.taxAmount)}</span>
                            </div>
                        )}
                        <div
                            className="flex justify-between text-lg font-bold pt-2 border-t-2"
                            style={{ borderColor: primaryColor }}
                        >
                            <span>Total</span>
                            <span className="font-mono" style={{ color: primaryColor }}>
                                {fmt(document.total)}
                            </span>
                        </div>
                        {document.amountPaid !== undefined && document.amountPaid > 0 && (
                            <div className="flex justify-between text-sm text-emerald-600">
                                <span>Paid</span>
                                <span className="font-mono">-{fmt(document.amountPaid)}</span>
                            </div>
                        )}
                        {document.amountDue !== undefined && document.amountDue > 0 && (
                            <div className="flex justify-between text-base font-bold">
                                <span>Amount Due</span>
                                <span className="font-mono">{fmt(document.amountDue)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Payment Info */}
            {config.showPaymentInfo && document.bankName && (
                <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-200">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Payment Information</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-zinc-500">Bank</p>
                            <p className="font-medium">{document.bankName}</p>
                        </div>
                        <div>
                            <p className="text-zinc-500">Account Number</p>
                            <p className="font-medium font-mono">{document.accountNumber}</p>
                        </div>
                        <div>
                            <p className="text-zinc-500">Payment Method</p>
                            <p className="font-medium">{document.paymentMethod || 'Bank Transfer'}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes & Terms */}
            {(document.notes || document.terms) && (
                <div className="px-8 py-6 border-t border-zinc-200">
                    {document.notes && (
                        <div className="mb-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-1">Notes</h3>
                            <p className="text-sm text-zinc-600">{document.notes}</p>
                        </div>
                    )}
                    {document.terms && (
                        <div>
                            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-1">Terms & Conditions</h3>
                            <p className="text-xs text-zinc-500">{document.terms}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="px-8 py-4 border-t border-zinc-200 mt-auto">
                <div className="flex justify-between text-xs text-zinc-400">
                    <span>Generated by BalanceIO</span>
                    <span>{document.documentNumber} • {formatDate(document.documentDate)}</span>
                </div>
            </div>
        </div>
    );
}
