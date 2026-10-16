"use client";

import { InvoicePreview } from "@/components/sales/invoice-preview";
import { defaultInvoices } from "@/lib/data/sales-data";
import { ReceivePaymentModal } from "@/components/sales/receive-payment-modal";
import React, { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";

function InvoiceDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    // Mock fetch
    const invoice =
        defaultInvoices.find((i) => i.id === id) || defaultInvoices[0];
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-end print:hidden">
                <Button
                    onClick={() => setIsPaymentOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    <Wallet className="h-4 w-4 mr-2" /> Receive Payment
                </Button>
            </div>

            <InvoicePreview invoice={invoice} />

            <ReceivePaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                invoiceId={invoice.id}
                customerName={invoice.contactName || ""}
                amountDue={invoice.amountDue !== undefined ? invoice.amountDue : invoice.total}
                currency={invoice.currency || "IDR"}
                bookedExchangeRate={invoice.exchangeRate || 1}
                onSuccess={() => {
                    window.location.reload();
                }}
            />
        </div>
    );
}

export default function InvoiceViewPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <InvoiceDetailContent />
        </Suspense>
    );
}
