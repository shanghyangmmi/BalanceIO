"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils/formatter";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { AssetsScheduleResponse } from "@/lib/types/reports";
import { Loader2 } from "lucide-react";

export default function AssetsScheduleReportPage() {
  const [data, setData] = useState<AssetsScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await apiClient.get<AssetsScheduleResponse>("/Reports/assets-schedule");
        setData(response);
      } catch (error) {
        console.error("Failed to fetch assets schedule", error);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, []);

  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Fixed Assets Schedule</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Depreciation Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Asset Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Acquisition Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Acquisition Cost</TableHead>
                <TableHead className="text-right">Accumulated Dep.</TableHead>
                <TableHead className="text-right">Book Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((item) => (
                <TableRow key={item.assetId}>
                  <TableCell className="font-mono text-xs">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{formatDate(item.acquisitionDate)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.method}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.accumulatedDepreciation)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(item.bookValue)}</TableCell>
                </TableRow>
              ))}

              {/* Totals Row */}
              {data && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalCost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalAccumulatedDepreciation)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalBookValue)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
