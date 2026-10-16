"use client";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { billColumns } from "@/components/purchases/bill-columns";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/formatter";
import Link from "next/link";

export default function PurchasesPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBills() {
      try {
        const data = await apiClient.get<any[]>("/PurchaseBills");
        setBills(data);
      } catch (error) {
        console.error("Failed to fetch purchase bills", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBills();
  }, []);

  const totalExpenses = bills.reduce((sum, b) => sum + (b.totalAmount || b.total || 0), 0);
  const unpaidBills = bills.filter(b => b.status === 0 || b.status === "Draft" || b.status === 1 || b.status === "Posted");
  const comingDue = unpaidBills.reduce((sum, b) => sum + (b.totalAmount || b.total || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Purchases</h2>
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/purchases/bills/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Record Bill
            </Button>
          </Link>
        </div>
      </div>
      <Tabs defaultValue="bills" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bills">Bills</TabsTrigger>
        </TabsList>
        <TabsContent value="bills" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground">{bills.length} bills</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(comingDue)}
                </div>
                <p className="text-xs text-muted-foreground">{unpaidBills.length} unpaid</p>
              </CardContent>
            </Card>
          </div>
          <div className="h-full flex-1 flex-col space-y-8 md:flex">
            <DataTable
              data={bills}
              columns={billColumns}
              filterColumn="vendorName"
              filterPlaceholder="Filter by vendor..."
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
