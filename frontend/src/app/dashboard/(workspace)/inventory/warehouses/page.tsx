"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Warehouse = {
  id: string;
  name: string;
  address: string;
  type: "Store" | "Warehouse" | "Distribution Center";
  status: "Active" | "Inactive";
};

const warehouses: Warehouse[] = [
  {
    id: "WH-001",
    name: "Central Warehouse Jakarta",
    address: "Jl. Industri Raya No. 1, Jakarta Utara",
    type: "Distribution Center",
    status: "Active",
  },
  {
    id: "WH-002",
    name: "Store Bandung - Outlet 1",
    address: "Jl. Riau No. 55, Bandung",
    type: "Store",
    status: "Active",
  },
  {
    id: "WH-003",
    name: "Surabaya Transit Hub",
    address: "Jl. Perak Timur, Surabaya",
    type: "Warehouse",
    status: "Active",
  },
];

export default function WarehousesPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gradient">
            Warehouses & Locations
          </h2>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Location
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((wh) => (
          <div key={wh.id} className="border rounded-lg p-6 bg-card">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <Badge variant={wh.status === "Active" ? "default" : "secondary"}>
                {wh.status}
              </Badge>
            </div>
            <h3 className="text-xl font-bold mb-1">{wh.name}</h3>
            <p className="text-xs text-muted-foreground mb-4 font-mono">
              {wh.id}
            </p>

            <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{wh.address}</span>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {wh.type}
              </span>
              <Button variant="ghost" size="sm">
                Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
