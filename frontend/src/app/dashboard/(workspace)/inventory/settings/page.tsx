"use client";
import { UoMSettings } from "@/components/inventory/uom-settings";
export default function InventorySettingsPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        {" "}
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Inventory Settings
        </h2>{" "}
      </div>
      <div className="max-w-4xl space-y-4">
        {" "}
        <UoMSettings />{" "}
      </div>{" "}
    </div>
  );
}
