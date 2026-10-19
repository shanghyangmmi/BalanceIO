"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { invoiceColumns } from "@/components/sales/invoice-columns";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/formatter";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { SalesInvoice } from "@/lib/types/sales";
import { toast } from "sonner";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function SalesPage() {
    const can = useCan();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    totalSales: 0,
    overdueCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getInvoices();
      setInvoices(data);
      calculateMetrics(data);
    } catch (error) {
      console.error("Failed to load invoices", error);
      toast.error("Failed to load sales data");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetrics = (data: SalesInvoice[]) => {
    const total = data
      .filter(i => i.status !== 'Void' && i.status !== 'Draft')
      .reduce((sum, i) => sum + i.total, 0);

    const overdue = data.filter(i => i.status === 'Overdue').length;

    setMetrics({
      totalSales: total,
      overdueCount: overdue
    });
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Sales</h2>
        <div className="flex items-center space-x-2">
          {can(PERMISSIONS.SalesCreate) && <Link href="/dashboard/sales/invoices/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </Link>}
        </div>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          {/* Placeholder for Products */}
          {/* <TabsTrigger value="products">Products & Services</TabsTrigger> */}
        </TabsList>
        <TabsContent value="invoices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sales (All Time)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : formatCurrency(metrics.totalSales)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Overdue Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metrics.overdueCount > 0 ? 'text-red-500' : ''}`}>
                  {isLoading ? "..." : metrics.overdueCount}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="h-full flex-1 flex-col space-y-8 md:flex">
            {isLoading ? (
              <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DataTable
                data={invoices}
                columns={invoiceColumns}
                filterColumn="contactName"
                filterPlaceholder="Filter by customer..."
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
