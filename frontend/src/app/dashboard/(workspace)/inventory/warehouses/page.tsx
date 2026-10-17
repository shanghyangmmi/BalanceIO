"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCan } from "@/components/auth/rbac-guard"
import { useCompany } from "@/contexts/company-context"
import { ModuleLocked, isModuleLocked } from "@/components/dashboard/module/module-locked"
import { SectionHeading } from "@/components/dashboard/module/module-primitives"

/** Mirrors Models/Warehouse.cs. */
interface Warehouse {
  id: string
  code: string
  name: string
  address: string | null
  city: string | null
  type: 0 | 1 | 2
  isActive: boolean
}

const TYPES = ["Warehouse", "Store", "Distribution center"] as const

type Draft = Omit<Warehouse, "id"> & { id?: string }

const EMPTY: Draft = { code: "", name: "", address: "", city: "", type: 0, isActive: true }

/**
 * Where stock is kept. Master data: quantities and valuation are tracked for
 * the company as a whole, not per location, and this page says so rather
 * than inventing per-warehouse figures.
 */
export default function WarehousesPage() {
  const can = useCan()
  const { company } = useCompany()
  const client = useQueryClient()
  const [editing, setEditing] = useState<Draft | null>(null)

  const key = ["warehouses", company?.id]
  const { data, isPending, isError, error } = useQuery({
    queryKey: key,
    queryFn: () => apiClient.get<Warehouse[]>("/Warehouses"),
    enabled: !!company,
    retry: retryUnlessClientError,
  })

  const save = useMutation({
    mutationFn: (w: Draft) =>
      w.id ? apiClient.put<Warehouse>(`/Warehouses/${w.id}`, w) : apiClient.post<Warehouse>("/Warehouses", w),
    onSuccess: () => {
      setEditing(null)
      return client.invalidateQueries({ queryKey: key })
    },
  })

  if (isError && isModuleLocked(error)) return <ModuleLocked moduleName="Inventory" />

  return (
    <div className="flex-1 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Inventory</span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Warehouses</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            The locations stock is kept in. Quantities and valuation are tracked for the company as a whole;
            stock per location is not recorded.
          </p>
        </div>
        {can(PERMISSIONS.InventoryManage) && (
          <Button onClick={() => setEditing({ ...EMPTY })} className="rounded-full">
            <Plus className="mr-2 h-4 w-4" /> New warehouse
          </Button>
        )}
      </header>

      <section className="space-y-5">
        <SectionHeading note={data ? `${data.length} locations` : undefined}>Locations</SectionHeading>
        <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-5 py-3 font-normal">Code</th>
                <th className="px-3 py-3 font-normal">Name</th>
                <th className="px-3 py-3 font-normal">Type</th>
                <th className="px-3 py-3 font-normal">Location</th>
                <th className="px-3 py-3 font-normal">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={6} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td></tr>
              ) : isError ? (
                <tr><td colSpan={6} className="px-5 py-6 text-muted-foreground">{error instanceof Error ? error.message : "Warehouses could not be loaded."}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-muted-foreground">No warehouse recorded yet.</td></tr>
              ) : (
                data.map((w) => (
                  <tr key={w.id} className="border-t border-foreground/10 first:border-t-0">
                    <td className="px-5 py-3 font-mono text-[12px]">{w.code}</td>
                    <td className="px-3 py-3 text-foreground">{w.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{TYPES[w.type]}</td>
                    <td className="px-3 py-3 text-muted-foreground">{[w.address, w.city].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={w.isActive ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
                        {w.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {can(PERMISSIONS.InventoryManage) && (
                        <Button size="sm" variant="outline" className="h-7 rounded-full border-foreground/15 px-3 text-xs" onClick={() => setEditing({ ...w })}>
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="sm:max-w-md">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(editing)
              }}
            >
              <DialogHeader>
                <DialogTitle>{editing.id ? "Edit warehouse" : "New warehouse"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wh-code">Code</Label>
                  <Input id="wh-code" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="font-mono" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="wh-name">Name</Label>
                  <Input id="wh-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-address">Address</Label>
                <Input id="wh-address" value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wh-city">City</Label>
                  <Input id="wh-city" value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wh-type">Type</Label>
                  <Select value={String(editing.type)} onValueChange={(v) => setEditing({ ...editing, type: Number(v) as Warehouse["type"] })}>
                    <SelectTrigger id="wh-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t, i) => <SelectItem key={t} value={String(i)}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="wh-active" className="font-normal">Active</Label>
                <Switch id="wh-active" checked={editing.isActive} onCheckedChange={(v) => setEditing({ ...editing, isActive: v })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending || !editing.code.trim() || !editing.name.trim()}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
