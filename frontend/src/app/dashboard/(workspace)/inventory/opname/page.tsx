"use client";

import { WarehouseSelect } from "@/components/inventory/warehouse-select";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, PlusCircle, Loader2, Eye } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate } from "@/lib/utils/formatter";
import { Badge } from "@/components/ui/badge";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface StockOpname {
  id: string;
  opnameNumber: string;
  opnameDate: string;
  status: number;
  description?: string;
}

export default function StockOpnamePage() {
  const [warehouseId, setWarehouseId] = useState("");
    const can = useCan();
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpnames();
  }, []);

  const fetchOpnames = async () => {
    try {
      const data = await apiClient.getStockOpnames();
      setOpnames(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load opname history");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Create a draft immediately and redirect
      const draft = await apiClient.createStockOpname({
        opnameDate: new Date().toISOString().split('T')[0],
        status: 0,
        // A count of one warehouse; empty counts the company total.
        warehouseId: warehouseId || null,
      });
      // Initialize it with current stock? Maybe let user decide in detail page.
      // For now, let's just redirect.
      window.location.href = `/dashboard/inventory/opname/${draft.id}`;
    } catch (error) {
      toast.error("Failed to create new session");
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Stock Opname</h2>
        {can(PERMISSIONS.InventoryOpname) && (
          <div className="flex items-end gap-3">
            <div className="w-64">
              <WarehouseSelect value={warehouseId} onChange={setWarehouseId} label="Warehouse to count" id="opname-warehouse" />
            </div>
            <Button onClick={handleCreate}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Session
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opname History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opnames.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    No stock opname sessions found.
                  </TableCell>
                </TableRow>
              )}
              {opnames.map((op) => (
                <TableRow key={op.id}>
                  <TableCell className="font-mono font-medium">{op.opnameNumber}</TableCell>
                  <TableCell>{formatDate(op.opnameDate)}</TableCell>
                  <TableCell>{op.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={op.status === 1 ? "secondary" : "default"}>
                      {op.status === 1 ? "Processed" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/inventory/opname/${op.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
