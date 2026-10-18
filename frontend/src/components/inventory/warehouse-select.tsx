"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWarehouses } from "@/hooks/use-warehouses"

/**
 * Picks the warehouse stock leaves or enters. Empty means the company's
 * default, which is what the API uses when none is sent. Hidden while the
 * company has only one warehouse: there is nothing to choose.
 */
export function WarehouseSelect({
  value,
  onChange,
  label = "Warehouse",
  id = "warehouse",
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  id?: string
}) {
  const { data } = useWarehouses()
  const active = (data ?? []).filter((w) => w.isActive)
  if (active.length <= 1) return null

  const fallback = active.find((w) => w.isDefault)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || fallback?.id || ""} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Default warehouse" />
        </SelectTrigger>
        <SelectContent>
          {active.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.code} · {w.name}{w.isDefault ? " (default)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
