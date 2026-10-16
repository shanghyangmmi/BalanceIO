"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { Product } from "@/lib/types/inventory"

const adjustmentSchema = z.object({
    quantity: z.number().refine((val) => val !== 0, "Adjustment quantity cannot be 0"),
    reason: z.string().min(1, "Reason is required"),
})

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>

interface StockAdjustmentDialogProps {
    product: Product | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function StockAdjustmentDialog({
    product,
    open,
    onOpenChange,
    onSuccess,
}: StockAdjustmentDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            quantity: 0,
            reason: "",
        },
    })

    if (!product) return null

    async function onSubmit(data: AdjustmentFormValues) {
        if (!product) return

        try {
            setIsSubmitting(true)
            await apiClient.adjustStock(product.id, data)
            toast.success("Stock adjusted successfully")
            onOpenChange(false)
            onSuccess()
            form.reset()
        } catch (error) {
            console.error("Failed to adjust stock", error)
            toast.error("Failed to adjust stock")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Adjust Stock</DialogTitle>
                    <DialogDescription>
                        Adjust stock level for <strong>{product.name}</strong>.
                        Current Stock: {product.stockOnHand} {product.unit}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adjustment Quantity</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder="e.g. 5 or -2"
                                            {...field}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground">
                                        Positive to add stock, negative to reduce.
                                    </p>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="e.g. Stock Opname, Damage, Gift"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Adjust Stock
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
