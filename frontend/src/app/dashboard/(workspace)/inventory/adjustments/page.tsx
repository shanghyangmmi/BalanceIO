import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";
export default function StockAdjustmentPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col space-y-2">
        {" "}
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Stock Adjustment
        </h2>{" "}
      </div>
      <div className="bg-card/60 rounded-xl border border-foreground/10 p-6">
        {" "}
        <StockAdjustmentForm />{" "}
      </div>{" "}
    </div>
  );
}
