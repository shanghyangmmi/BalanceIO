"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { useCompany } from "@/contexts/company-context"
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard"
import { PERMISSIONS } from "@/lib/auth/permissions"

interface TrackedProduct {
    id: string
    code: string
    name: string
    unit: string
    stockOnHand: number
    buyPrice: number
    trackInventory: boolean
}

const adjustmentSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    type: z.enum(["IN", "OUT"]),
    quantity: z.number().positive("Quantity must be more than zero"),
    reason: z.string().min(1, "Reason is required"),
    date: z.string().min(1, "Date is required"),
})

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>

export function StockAdjustmentForm() {
    return (
        <RBACGuard permission={PERMISSIONS.InventoryOpname} fallback={<NoPermission permission={PERMISSIONS.InventoryOpname} />}>
            <AdjustmentForm />
        </RBACGuard>
    )
}

/**
 * A manual correction to stock on hand. The server records the movement
 * and posts its value against Inventory Variance (5-9000), so the
 * quantity and the inventory account stay in step.
 */
function AdjustmentForm() {
    const { company } = useCompany()
    const queryClient = useQueryClient()
    const { data: products = [] } = useQuery({
        queryKey: ["products", company?.id],
        queryFn: () => apiClient.get<TrackedProduct[]>("/Products"),
        enabled: !!company,
        retry: retryUnlessClientError,
        select: (all) => all.filter((p) => p.trackInventory),
    })
    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            productId: "",
            type: "IN",
            quantity: 1,
            reason: "",
            date: new Date().toISOString().split('T')[0],
        },
    })

    const adjust = useMutation({
        mutationFn: (data: AdjustmentFormValues) =>
            apiClient.post<{ stockOnHand: number; value: number }>(`/Products/${data.productId}/adjust-stock`, {
                quantity: data.type === "IN" ? data.quantity : -data.quantity,
                reason: data.reason,
                date: data.date,
            }),
        onSuccess: (res) => {
            toast.success(`Recorded. Stock on hand ${res.stockOnHand}; ${formatModuleMoney(res.value, "IDR")} posted to the ledger.`)
            form.reset({ ...form.getValues(), quantity: 1, reason: "" })
            return queryClient.invalidateQueries({ queryKey: ["products", company?.id] })
        },
    })

    function onSubmit(data: AdjustmentFormValues) {
        adjust.mutate(data)
    }

    const handleProductChange = (_val: string) => undefined

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="productId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Product</FormLabel>
                                <Select onValueChange={(val) => {
                                    field.onChange(val);
                                    handleProductChange(val);
                                }} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Product" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {products.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>{p.code} - {p.name} (on hand: {p.stockOnHand} {p.unit})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Adjustment Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="IN">Increase (found, returned)</SelectItem>
                                        <SelectItem value="OUT">Decrease (damaged, lost)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        {...field}
                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reason / Note</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g. Broken goods, Found extra stock" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit" className="w-full" disabled={adjust.isPending}>
                    {adjust.isPending ? "Recording…" : "Record adjustment"}
                </Button>
            </form>
        </Form>
    )
}
