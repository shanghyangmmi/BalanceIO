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
import { defaultProducts } from "@/lib/data/inventory-data"
import { formatCurrency } from "@/lib/utils/formatter"

const adjustmentSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    reason: z.string().min(1, "Reason is required"),
    date: z.string().min(1, "Date is required"),
})

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>

export function StockAdjustmentForm() {
    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            productId: "",
            type: "ADJUSTMENT",
            quantity: 1,
            reason: "",
            date: new Date().toISOString().split('T')[0],
        },
    })

    function onSubmit(data: AdjustmentFormValues) {
        alert("Stock Adjustment Recorded (Mock)");
    }

    const handleProductChange = (val: string) => {
        // Mock logic: Show current stock if needed
    }

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
                                        {defaultProducts.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>{p.code} - {p.name} (Qty: {p.stockOnHand})</SelectItem>
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
                                        <SelectItem value="IN">Stock In (Purchase/Return)</SelectItem>
                                        <SelectItem value="OUT">Stock Out (Sale/Damage)</SelectItem>
                                        <SelectItem value="ADJUSTMENT">Correction (Opname)</SelectItem>
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

                <Button type="submit" className="w-full">
                    Record Adjustment
                </Button>
            </form>
        </Form>
    )
}
