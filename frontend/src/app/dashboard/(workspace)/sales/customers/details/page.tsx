"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultCustomers, defaultInvoices } from "@/lib/data/sales-data";
import { DataTable } from "@/components/ui/data-table";
import { invoiceColumns } from "@/components/sales/invoice-columns";
import { Button } from "@/components/ui/button";
import { Mail, MapPin, Phone, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatter";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CustomerDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    // In a real app, fetch data based on ID
    const customer = defaultCustomers.find(c => c.id === id) || defaultCustomers[0];
    const customerInvoices = defaultInvoices.filter(
        (inv) => inv.contactId === customer.id
    );

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gradient">{customer.name}</h2>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {customer.email}
                        </span>
                        {customer.phone && (
                            <span className="flex items-center gap-1 ml-4">
                                <Phone className="h-3 w-3" /> {customer.phone}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                    <Button>New Invoice</Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Outstanding Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {formatCurrency(16650000)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Sales (YTD)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(150000000)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Billing Address</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 text-sm">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {customer.address}
                                    </p>
                                    <p className="text-muted-foreground mt-1">Indonesia</p>
                                </div>
                            </div>
                            <div className="border-t pt-4">
                                <p className="font-medium">Tax Info</p>
                                <p className="text-muted-foreground">
                                    NPWP: {customer.taxId || "-"}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Transaction History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            data={customerInvoices}
                            columns={invoiceColumns}
                            filterColumn="id"
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function CustomerDetailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CustomerDetailContent />
        </Suspense>
    );
}
