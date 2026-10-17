"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { getProductColumns } from "@/components/inventory/product-columns";
import { Button } from "@/components/ui/button";
import { PlusCircle, Package, AlertTriangle, Loader2 } from "lucide-react";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/formatter";
import { apiClient } from "@/lib/api-client";
import { Product } from "@/lib/types/inventory";
import { toast } from "sonner";
import Link from "next/link";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function InventoryPage() {
    const can = useCan();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalValue: 0,
    lowStockCount: 0
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getProducts();
      setProducts(data);
      calculateMetrics(data);
    } catch (error) {
      console.error("Failed to load products", error);
      toast.error("Failed to load inventory");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetrics = (data: Product[]) => {
    const totalValue = data.reduce((sum, p) => sum + (p.stockOnHand * p.buyPrice), 0);
    const lowStockCount = data.filter(p => p.trackInventory && p.stockOnHand <= p.reorderLevel).length;

    setMetrics({
      totalValue,
      lowStockCount
    });
  };

  const handleAdjustStock = (product: Product) => {
    setSelectedProduct(product);
    setIsAdjustmentOpen(true);
  };

  const columns = getProductColumns(
    can(PERMISSIONS.InventoryOpname) ? handleAdjustStock : undefined,
    can(PERMISSIONS.InventoryManage),
  );

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gradient">Inventory</h2>
        </div>
        <div className="flex items-center space-x-2">
          {can(PERMISSIONS.InventoryManage) && <Link href="/dashboard/inventory/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> New Product
            </Button>
          </Link>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inventory Value
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatCurrency(metrics.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Based on Buy Price</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Alerts
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${metrics.lowStockCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.lowStockCount > 0 ? 'text-orange-500' : ''}`}>
              {isLoading ? "..." : metrics.lowStockCount} Items
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Below reorder point
            </p>
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
            data={products}
            columns={columns}
            filterColumn="name"
            filterPlaceholder="Search products..."
          />
        )}
      </div>

      <StockAdjustmentDialog
        open={isAdjustmentOpen}
        onOpenChange={setIsAdjustmentOpen}
        product={selectedProduct}
        onSuccess={loadData}
      />
    </div>
  );
}
