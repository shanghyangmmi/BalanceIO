"use client";

import { useState } from 'react';
import { InvoiceData, TemplateConfig, defaultTemplateConfig } from './types';
import {
    ClassicTemplate,
    ModernTemplate,
    MinimalTemplate,
    BoldTemplate,
    ElegantTemplate,
    invoiceTemplates,
    TemplateName
} from './templates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FileDown, Printer, Eye, Layout } from 'lucide-react';

interface DocumentPreviewProps {
    invoice: InvoiceData;
    config?: Partial<TemplateConfig>;
    defaultTemplate?: TemplateName;
    showControls?: boolean;
    onExportPdf?: () => void;
    onPrint?: () => void;
}

/**
 * Document Preview Component
 * Displays invoice with template selector and export controls.
 */
export function DocumentPreview({
    invoice,
    config,
    defaultTemplate = 'classic',
    showControls = true,
    onExportPdf,
    onPrint,
}: DocumentPreviewProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>(defaultTemplate);
    const cfg = { ...defaultTemplateConfig, ...config };

    const handlePrint = () => {
        if (onPrint) {
            onPrint();
        } else {
            window.print();
        }
    };

    const renderTemplate = () => {
        switch (selectedTemplate) {
            case 'modern':
                return <ModernTemplate invoice={invoice} config={cfg} />;
            case 'minimal':
                return <MinimalTemplate invoice={invoice} config={cfg} />;
            case 'bold':
                return <BoldTemplate invoice={invoice} config={cfg} />;
            case 'elegant':
                return <ElegantTemplate invoice={invoice} config={cfg} />;
            case 'classic':
            default:
                return <ClassicTemplate invoice={invoice} config={cfg} />;
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Controls Bar */}
            {showControls && (
                <div className="flex items-center justify-between gap-4 p-4 border-b bg-zinc-50 dark:bg-zinc-900 print:hidden">
                    {/* Template Selector */}
                    <div className="flex items-center gap-2">
                        <Layout className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Template:</span>
                        <div className="flex gap-1">
                            {(Object.keys(invoiceTemplates) as TemplateName[]).map((key) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedTemplate(key)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                        selectedTemplate === key
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
                                    )}
                                >
                                    {invoiceTemplates[key].name}
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
                            <Button size="sm" onClick={onExportPdf} >
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
                    {renderTemplate()}
                </div>
            </div>
        </div>
    );
}
