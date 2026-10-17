"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultVendors, defaultBills } from "@/lib/data/purchases-data";
import { DataTable } from "@/components/ui/data-table";
import { billColumns } from "@/components/purchases/bill-columns";
import { Button } from "@/components/ui/button";
import { Mail, MapPin, Phone, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatter";
import React, { Suspense } from "react";
import { PayBillModal } from "@/components/purchases/pay-bill-modal";
import { useSearchParams } from "next/navigation";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

function VendorDetailContent() {
    const can = useCan();
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    // In a real app, fetch data based on ID
    // Mock: Try to find by ID or fallback to first
    const vendor = defaultVendors.find(v => v.id === id) || defaultVendors[0];
    const vendorBills = defaultBills.filter(
        (bill) => bill.vendorId === vendor.id
    );

    const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);

    return (
        <div className="flex-1 space-y-6">
            <PayBillModal
                isOpen={isPayModalOpen}
                onClose={() => setIsPayModalOpen(false)}
                billId="BILL-2024-002"
                vendorName={vendor.name}
                amountDue={33500000}
            />

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gradient">{vendor.name}</h2>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {vendor.email}
                        </span>
                        {vendor.phone && (
                            <span className="flex items-center gap-1 ml-4">
                                <Phone className="h-3 w-3" /> {vendor.phone}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                    {can(PERMISSIONS.PurchasesCreate) && <Button variant="secondary" onClick={() => setIsPayModalOpen(true)}>
                        Make Payment
                    </Button>}
                    <Button>Record Bill</Button>
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
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(45000000)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Expenses (YTD)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(120000000)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Vendor Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 text-sm">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {vendor.address}
                                    </p>
                                    <p className="text-muted-foreground mt-1">Indonesia</p>
                                </div>
                            </div>
                            <div className="border-t pt-4">
                                <p className="font-medium">Tax Info</p>
                                <p className="text-muted-foreground">
                                    NPWP: {vendor.taxId || "-"}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Bill History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            data={vendorBills}
                            columns={billColumns}
                            filterColumn="id"
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function VendorDetailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VendorDetailContent />
        </Suspense>
    );
}
