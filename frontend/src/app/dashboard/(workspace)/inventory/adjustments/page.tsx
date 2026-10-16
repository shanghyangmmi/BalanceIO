import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";
export default function StockAdjustmentPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col space-y-2">
        {" "}
        <h2 className="text-3xl font-bold tracking-tight text-gradient">
          Stock Adjustment
        </h2>{" "}
      </div>
      <div className="bg-white dark:bg-zinc-900 rounded-lg border p-6 shadow-sm">
        {" "}
        <StockAdjustmentForm />{" "}
      </div>{" "}
    </div>
  );
}
