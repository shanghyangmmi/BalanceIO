"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { expenseColumns } from "@/components/purchases/expense-columns";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/formatter";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Expense } from "@/lib/types/expense";
import { toast } from "sonner";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function ExpensesPage() {
    const can = useCan();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    totalExpenses: 0,
    count: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getExpenses();
      // The API returns a list of objects matching Expense interface
      setExpenses(data);
      calculateMetrics(data);
    } catch (error) {
      console.error("Failed to load expenses", error);
      toast.error("Failed to load expenses");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetrics = (data: Expense[]) => {
    const total = data.reduce((sum, e) => sum + e.amount, 0);
    setMetrics({
      totalExpenses: total,
      count: data.length
    });
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Expenses</h2>
        <div className="flex items-center space-x-2">
          {can(PERMISSIONS.FinanceCreate) && <Link href="/dashboard/expenses/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Expense
            </Button>
          </Link>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses (Visible Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatCurrency(metrics.totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : metrics.count}
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
            data={expenses}
            columns={expenseColumns}
            filterColumn="description"
            filterPlaceholder="Filter expenses..."
          />
        )}
      </div>
    </div>
  );
}
