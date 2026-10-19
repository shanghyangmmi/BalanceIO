"use client";

import { useRef, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { DocumentPreview } from "@/components/documents";
import { exportToPdf } from "@/components/documents/pdf-export";
import { apiClient } from "@/lib/api-client";
import { retryUnlessClientError } from "@/lib/query-retry";
import { toInvoiceData, type ApiSalesInvoice } from "@/lib/documents/invoice-mapper";
import { useCompanyData } from "@/hooks/use-company-data";
import { useCompany } from "@/contexts/company-context";

/** The stored invoice, rendered through the print templates. */
function InvoicePreviewContent() {
  const previewRef = useRef<HTMLDivElement>(null);
  const id = useSearchParams().get("id");
  const { company: scope } = useCompany();
  const { company, isLoading: companyLoading } = useCompanyData();

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["sales-invoice", scope?.id, id],
    queryFn: () => apiClient.get<ApiSalesInvoice>(`/SalesInvoices/${id}`),
    enabled: !!scope && !!id,
    retry: retryUnlessClientError,
  });

  const invoice = data && !companyLoading ? toInvoiceData(data, company) : null;

  const handleExportPdf = useCallback(async () => {
    const element = previewRef.current?.querySelector(".shadow-xl > div") as HTMLElement;
    if (!element || !invoice) {
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
      toast.success("PDF exported", { id: "pdf-export" });
    } catch (err) {
      toast.error("Failed to export PDF", { id: "pdf-export" });
      console.error(err);
    }
  }, [invoice]);

  if (!id) return <p className="p-6 text-sm text-muted-foreground">No invoice selected.</p>;
  if (isError) return <p className="p-6 text-sm text-muted-foreground">{error instanceof Error ? error.message : "The invoice could not be loaded."}</p>;
  if (isPending || !invoice) return <p className="p-6 text-sm text-muted-foreground">Loading invoice…</p>;

  return (
    <div className="h-[calc(100vh-4rem)]" ref={previewRef}>
      <DocumentPreview invoice={invoice} defaultTemplate="classic" showControls={true} onExportPdf={handleExportPdf} />
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
