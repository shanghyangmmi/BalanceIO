"use client";

import { useState } from "react";
import { UniversalDocumentPreview } from "@/components/documents/universal-document-preview";
import { DocumentType, documentTypeConfig } from "@/components/documents/document-types";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Group document types by category
const documentCategories = {
    sales: {
        label: "Sales",
        types: ["sales-invoice", "sales-order", "delivery-order", "receipt-voucher", "credit-note"] as DocumentType[],
    },
    purchases: {
        label: "Purchases",
        types: ["purchase-order", "goods-receipt", "purchase-bill", "payment-voucher", "debit-note"] as DocumentType[],
    },
    banking: {
        label: "Banking",
        types: ["bank-receipt", "bank-payment", "cash-receipt", "cash-payment", "fund-transfer"] as DocumentType[],
    },
    adjustments: {
        label: "Adjustments",
        types: ["journal-voucher", "opening-balance", "contra-entry"] as DocumentType[],
    },
};

export default function DocumentPreviewPage() {
    const [selectedType, setSelectedType] = useState<DocumentType>("sales-invoice");

    return (
        <div className="flex-1 flex flex-col h-screen">
            {/* Header */}
            <div className="px-6 py-4 border-b bg-white dark:bg-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/documents"
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">Document Templates</h1>
                        <p className="text-sm text-zinc-500">Preview all document types</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Document Type Selector */}
                <div className="w-64 border-r bg-zinc-50 dark:bg-zinc-900 overflow-y-auto">
                    {Object.entries(documentCategories).map(([key, category]) => (
                        <div key={key} className="p-4">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase mb-2">
                                {category.label}
                            </h3>
                            <div className="space-y-1">
                                {category.types.map((type) => {
                                    const config = documentTypeConfig[type];
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setSelectedType(type)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all",
                                                selectedType === type
                                                    ? "bg-card ring-1 ring-foreground/10 font-medium"
                                                    : "hover:bg-white/50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                                            )}
                                        >
                                            <div
                                                className="h-6 w-6 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                                                style={{ backgroundColor: config.color }}
                                            >
                                                {config.titleShort}
                                            </div>
                                            <span className="truncate">{config.title}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Preview Area */}
                <div className="flex-1 overflow-hidden">
                    <UniversalDocumentPreview
                        documentType={selectedType}
                        showControls={true}
                    />
                </div>
            </div>
        </div>
    );
}
