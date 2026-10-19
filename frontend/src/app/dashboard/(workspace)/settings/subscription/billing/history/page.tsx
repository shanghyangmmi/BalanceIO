"use client";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Receipt } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import Link from "next/link";
import { motion } from "framer-motion";

interface Payment {
    id: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string | null;
    invoiceNumber: string | null;
    description: string | null;
    createdAt: string;
    paidAt: string | null;
}

function PaymentHistoryPageContent() {
    const { company } = useCompanyData();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            if (!company?.id) return;
            try {
                const data = await apiClient.get<Payment[]>(`/subscriptions/payments/${company.id}`);
                setPayments(data);
            } catch (error) {
                console.error("Failed to fetch payments:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPayments();
    }, [company?.id]);

    const formatPrice = (amount: number, currency: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case "success":
                return <Badge className="bg-green-500">Success</Badge>;
            case "pending":
                return <Badge className="bg-amber-500">Pending</Badge>;
            case "failed":
                return <Badge className="bg-red-500">Failed</Badge>;
            case "refunded":
                return <Badge className="bg-zinc-500">Refunded</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/settings/billing">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Payment History</h2>
                    <p className="text-muted-foreground">View all your past transactions</p>
                </div>
            </div>

            {isLoading ? (
                <div className="h-48 flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Loading payment history...</div>
                </div>
            ) : payments.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">No payments yet</h3>
                        <p className="text-muted-foreground text-sm">
                            Your payment history will appear here once you make a purchase.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {payments.map((payment, idx) => (
                        <motion.div
                            key={payment.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card>
                                <CardContent className="flex items-center justify-between py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-full bg-muted">
                                            <Receipt className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="font-medium">{payment.description || "Subscription Payment"}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {formatDate(payment.createdAt)}
                                                {payment.invoiceNumber && ` • ${payment.invoiceNumber}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {getStatusBadge(payment.status)}
                                        <div className="text-right">
                                            <div className="font-bold">{formatPrice(payment.amount, payment.currency)}</div>
                                            {payment.paymentMethod && (
                                                <div className="text-xs text-muted-foreground capitalize">
                                                    {payment.paymentMethod.replace("_", " ")}
                                                </div>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="icon" disabled>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

// The page's data is readable only with Settings.View; without it, say so
// rather than firing requests the API refuses.
export default function PaymentHistoryPage() {
  return (
    <RBACGuard permission={PERMISSIONS.SettingsView} fallback={<NoPermission permission={PERMISSIONS.SettingsView} />}>
      <PaymentHistoryPageContent />
    </RBACGuard>
  );
}
