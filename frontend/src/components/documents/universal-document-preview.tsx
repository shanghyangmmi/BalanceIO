"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Printer, Layout } from "lucide-react";
import { DocumentData, DocumentType, documentTypeConfig, getSampleDocument } from "./document-types";
import { GenericDocumentTemplate } from "./generic-document-template";
import { cn } from "@/lib/utils";

interface UniversalDocumentPreviewProps {
    documentType: DocumentType;
    document?: DocumentData;
    showControls?: boolean;
    onExportPdf?: () => void;
    onPrint?: () => void;
}

/**
 * Universal Document Preview
 * Preview any document type with template selection and export controls
 */
export function UniversalDocumentPreview({
    documentType,
    document,
    showControls = true,
    onExportPdf,
    onPrint,
}: UniversalDocumentPreviewProps) {
    const [selectedVariant, setSelectedVariant] = useState<"classic" | "modern" | "minimal">("classic");

    // Use provided document or generate sample
    const doc = document || getSampleDocument(documentType);
    const config = documentTypeConfig[documentType];

    const handlePrint = () => {
        if (onPrint) {
            onPrint();
        } else {
            window.print();
        }
    };

    const variants = [
        { id: "classic", label: "Classic" },
        { id: "modern", label: "Modern" },
        { id: "minimal", label: "Minimal" },
    ] as const;

    return (
        <div className="flex flex-col h-full">
            {/* Controls Bar */}
            {showControls && (
                <div className="flex items-center justify-between gap-4 p-4 border-b bg-zinc-50 dark:bg-zinc-900 print:hidden">
                    {/* Template Info */}
                    <div className="flex items-center gap-3">
                        <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: config.color }}
                        >
                            {config.titleShort}
                        </div>
                        <div>
                            <p className="font-medium text-sm">{config.title}</p>
                            <p className="text-xs text-zinc-500">{doc.documentNumber}</p>
                        </div>
                    </div>

                    {/* Variant Selector */}
                    <div className="flex items-center gap-2">
                        <Layout className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Style:</span>
                        <div className="flex gap-1">
                            {variants.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setSelectedVariant(v.id)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                        selectedVariant === v.id
                                            ? "text-white"
                                            : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
                                    )}
                                    style={selectedVariant === v.id ? { backgroundColor: config.color } : {}}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        {onExportPdf && (
                            <Button
                                size="sm"
                                onClick={onExportPdf}
                                style={{ backgroundColor: config.color }}
                                className="hover:opacity-90"
                            >
                                <FileDown className="h-4 w-4 mr-2" />
                                Export PDF
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Preview Area */}
            <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-950 p-6 print:p-0 print:bg-white">
                <div className="shadow-xl print:shadow-none">
                    <GenericDocumentTemplate document={doc} variant={selectedVariant} />
                </div>
            </div>
        </div>
    );
}

// Export all document types for easy access
export { documentTypeConfig, getSampleDocument };
export type { DocumentData, DocumentType };
