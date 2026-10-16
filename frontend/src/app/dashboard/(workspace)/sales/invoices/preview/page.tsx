"use client";

import { useRef, useCallback, Suspense } from "react";
import { DocumentPreview, sampleInvoice } from "@/components/documents";
import { exportToPdf } from "@/components/documents/pdf-export";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

function InvoicePreviewContent() {
  const previewRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  // In a real app, you'd fetch the invoice data based on 'id'
  // For now, we use sampleInvoice which works for preview
  const invoice = sampleInvoice;

  const handleExportPdf = useCallback(async () => {
    const element = previewRef.current?.querySelector(
      ".shadow-xl > div",
    ) as HTMLElement;
    if (!element) {
      toast.error("Preview element not found");
      return;
    }

    try {
      toast.loading("Generating PDF...", { id: "pdf-export" });
      await exportToPdf(element, {
        filename: `${invoice.invoiceNumber}.pdf`,
        format: "a4",
        orientation: "portrait",
        margin: 0,
        quality: 0.98,
      });
      toast.success("PDF exported successfully!", { id: "pdf-export" });
    } catch (error) {
      toast.error("Failed to export PDF", { id: "pdf-export" });
      console.error(error);
    }
  }, [invoice.invoiceNumber]);

  return (
    <div className="h-[calc(100vh-4rem)]" ref={previewRef}>
      <DocumentPreview
        invoice={invoice}
        defaultTemplate="classic"
        showControls={true}
        onExportPdf={handleExportPdf}
      />
    </div>
  );
}

export default function InvoicePreviewPage() {
  return (
    <Suspense fallback={<div>Loading Preview...</div>}>
      <InvoicePreviewContent />
    </Suspense>
  );
}
