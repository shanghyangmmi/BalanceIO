"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowRightLeft, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { isStorableAmount } from "@/lib/utils/minor-units"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCan } from "@/components/auth/rbac-guard"
import { useWarehouses, useWarehouseStock, type Warehouse } from "@/hooks/use-warehouses"
import { ModuleLocked, isModuleLocked } from "@/components/dashboard/module/module-locked"
import { SectionHeading } from "@/components/dashboard/module/module-primitives"

const TYPES = ["Warehouse", "Store", "Distribution center"] as const

type Draft = Omit<Warehouse, "id"> & { id?: string }

const EMPTY: Draft = { code: "", name: "", address: "", city: "", type: 0, isActive: true, isDefault: false }

/**
 * Where stock is kept, and how much of it each place holds. Quantities are
 * the sum of the movements recorded against each warehouse; together they
 * equal each product's stock on hand. Value is at the product's buy price.
 */
export default function WarehousesPage() {
  const can = useCan()
  const client = useQueryClient()
  const warehouses = useWarehouses()
  const stock = useWarehouseStock()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [filter, setFilter] = useState("all")

  const invalidate = () => client.invalidateQueries({ queryKey: ["warehouses"] })

  const save = useMutation({
    mutationFn: (w: Draft) =>
      w.id ? apiClient.put<Warehouse>(`/Warehouses/${w.id}`, w) : apiClient.post<Warehouse>("/Warehouses", w),
    onSuccess: () => {
      setEditing(null)
      return invalidate()
    },
  })

  const rows = useMemo(
    () => (stock.data?.rows ?? []).filter((r) => filter === "all" || r.warehouseId === filter),
    [stock.data, filter],
  )

  if (warehouses.isError && isModuleLocked(warehouses.error)) return <ModuleLocked moduleName="Inventory" />

  const manage = can(PERMISSIONS.InventoryManage)

  return (
    <div className="flex-1 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Inventory</span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Warehouses</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Stock held at each location. Purchases, sales, adjustments and counts name the warehouse they move;
            documents that name none use the default. Transfers move stock between warehouses without a journal
            entry: the company still holds the same goods at the same cost.
          </p>
        </div>
        {manage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferring(true)} className="rounded-full border-foreground/15">
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer stock
            </Button>
            <Button onClick={() => setEditing({ ...EMPTY })} className="rounded-full">
              <Plus className="mr-2 h-4 w-4" /> New warehouse
            </Button>
          </div>
        )}
      </header>

      <section className="space-y-5">
        <SectionHeading note={warehouses.data ? `${warehouses.data.length} locations` : undefined}>Locations</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.isPending || stock.isPending
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
            : (warehouses.data ?? []).map((w) => {
                const summary = stock.data?.warehouses.find((s) => s.id === w.id)
                return (
                  <div key={w.id} className={cn("rounded-xl border bg-card/60 p-5", w.isDefault ? "border-emerald-600/30 dark:border-emerald-400/30" : "border-foreground/10", !w.isActive && "opacity-60")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-muted-foreground">{w.code}</div>
                        <div className="truncate font-medium text-foreground">{w.name}</div>
                        <div className="truncate text-[12px] text-muted-foreground">{[w.address, w.city].filter(Boolean).join(", ") || TYPES[w.type]}</div>
                      </div>
                      <span className={cn("shrink-0 font-mono text-[9.5px] uppercase tracking-[0.16em]", w.isDefault ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                        {w.isDefault ? "Default" : w.isActive ? TYPES[w.type] : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-foreground/10 pt-3">
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Items</div>
                        <div className="font-money text-sm">{summary?.items ?? 0}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Value at cost</div>
                        <div className="font-money text-sm">{formatModuleMoney(summary?.value ?? 0, "IDR")}</div>
                      </div>
                    </div>
                    {(summary?.negative ?? 0) > 0 && (
                      <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">
                        {summary!.negative} item(s) below zero: more was sold from here than recorded in.
                      </p>
                    )}
                    {manage && (
                      <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" onClick={() => setEditing({ ...w })}>
                        Edit
                      </Button>
                    )}
                  </div>
                )
              })}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading note={`${rows.length} lines`}>Stock by warehouse</SectionHeading>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {(warehouses.data ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.code} · {w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60">
          <table className="w-full min-w-[640px] text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-5 py-3 font-normal">Warehouse</th>
                <th className="px-3 py-3 font-normal">Product</th>
                <th className="px-3 py-3 text-right font-normal">Quantity</th>
                <th className="px-3 py-3 text-right font-normal">Unit cost</th>
                <th className="px-5 py-3 text-right font-normal">Value</th>
              </tr>
            </thead>
            <tbody>
              {stock.isPending ? (
                <tr><td colSpan={5} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td></tr>
              ) : stock.isError ? (
                <tr><td colSpan={5} className="px-5 py-6 text-muted-foreground">{stock.error instanceof Error ? stock.error.message : "Stock could not be loaded."}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-6 text-muted-foreground">No stock recorded.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.warehouseId}-${r.productId}`} className="border-t border-foreground/10 first:border-t-0">
                    <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{r.warehouseCode}</td>
                    <td className="px-3 py-3"><span className="font-mono text-[12px] text-muted-foreground">{r.productCode}</span> {r.productName}</td>
                    <td className={cn("px-3 py-3 text-right", r.quantity < 0 && "text-amber-700 dark:text-amber-400")}>{r.quantity} {r.unit}</td>
                    <td className="px-3 py-3 text-right">{formatModuleMoney(r.unitCost, "IDR")}</td>
                    <td className="px-5 py-3 text-right text-foreground">{formatModuleMoney(r.value, "IDR")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <WarehouseDialog draft={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={() => save.mutate(editing)} saving={save.isPending} />
      )}
      {transferring && <TransferDialog onClose={() => setTransferring(false)} onDone={invalidate} />}
    </div>
  )
}

function WarehouseDialog({ draft, onChange, onClose, onSave, saving }: {
  draft: Draft
  onChange: (d: Draft) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave() }}>
          <DialogHeader><DialogTitle>{draft.id ? "Edit warehouse" : "New warehouse"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wh-code">Code</Label>
              <Input id="wh-code" value={draft.code} onChange={(e) => onChange({ ...draft, code: e.target.value })} className="font-mono" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="wh-name">Name</Label>
              <Input id="wh-name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-address">Address</Label>
            <Input id="wh-address" value={draft.address ?? ""} onChange={(e) => onChange({ ...draft, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wh-city">City</Label>
              <Input id="wh-city" value={draft.city ?? ""} onChange={(e) => onChange({ ...draft, city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-type">Type</Label>
              <Select value={String(draft.type)} onValueChange={(v) => onChange({ ...draft, type: Number(v) as Warehouse["type"] })}>
                <SelectTrigger id="wh-type"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t, i) => <SelectItem key={t} value={String(i)}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="wh-default" className="font-normal">Default warehouse</Label>
            <Switch id="wh-default" checked={draft.isDefault} disabled={!!draft.id && draft.isDefault} onCheckedChange={(v) => onChange({ ...draft, isDefault: v, isActive: v ? true : draft.isActive })} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="wh-active" className="font-normal">Active</Label>
            <Switch id="wh-active" checked={draft.isActive} disabled={draft.isDefault} onCheckedChange={(v) => onChange({ ...draft, isActive: v })} />
          </div>
          <p className="text-[12px] text-muted-foreground">
            Documents that name no warehouse use the default. It cannot be deactivated; make another warehouse the default first.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !draft.code.trim() || !draft.name.trim()}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TransferDialog({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<unknown> }) {
  const warehouses = useWarehouses()
  const stock = useWarehouseStock()
  const active = (warehouses.data ?? []).filter((w) => w.isActive)
  const [from, setFrom] = useState(active.find((w) => w.isDefault)?.id ?? "")
  const [to, setTo] = useState("")
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")

  const available = (stock.data?.rows ?? []).filter((r) => r.warehouseId === from && r.quantity > 0)
  const selected = available.find((r) => r.productId === productId)
  const qtyOk = quantity.trim() !== "" && isStorableAmount(quantity) && Number(quantity) > 0 && (!selected || Number(quantity) <= selected.quantity)

  const transfer = useMutation({
    mutationFn: () => apiClient.post("/Warehouses/transfers", { productId, fromWarehouseId: from, toWarehouseId: to, quantity: Number(quantity), date, notes }),
    onSuccess: async () => {
      await onDone()
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); transfer.mutate() }}>
          <DialogHeader><DialogTitle>Transfer stock</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-from">From</Label>
              <Select value={from} onValueChange={(v) => { setFrom(v); setProductId("") }}>
                <SelectTrigger id="tr-from"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>{active.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} · {w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-to">To</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger id="tr-to"><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>{active.filter((w) => w.id !== from).map((w) => <SelectItem key={w.id} value={w.id}>{w.code} · {w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="tr-product"><SelectValue placeholder={available.length ? "Choose a product" : "Nothing in stock here"} /></SelectTrigger>
              <SelectContent>
                {available.map((r) => <SelectItem key={r.productId} value={r.productId}>{r.productCode} · {r.productName} ({r.quantity} {r.unit})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-qty">Quantity</Label>
              <Input id="tr-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono tabular-nums" aria-invalid={quantity !== "" && !qtyOk} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-date">Date</Label>
              <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-notes">Notes</Label>
            <Input id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Restock for Surabaya store" />
          </div>
          {selected && Number(quantity) > selected.quantity && (
            <p className="text-[12px] text-amber-700 dark:text-amber-400">Only {selected.quantity} {selected.unit} in the source warehouse.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={transfer.isPending || !from || !to || !productId || !qtyOk}>{transfer.isPending ? "Moving…" : "Transfer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
