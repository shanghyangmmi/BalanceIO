"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
    Form,
    FormControl,
    FormDescription,
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
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from "react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
// import { useRouter } from "next/navigation"

const productSchema = z.object({
    name: z.string().min(1, "Name is required"),
    code: z.string(), // Empty string allowed, backend generates it
    type: z.number().min(0).max(1),
    unit: z.string().min(1, "Unit is required"),
    sellPrice: z.number().min(0),
    buyPrice: z.number().min(0),
    trackInventory: z.boolean(),
    stockOnHand: z.number().min(0),
    reorderLevel: z.number().min(0),
    isActive: z.boolean(),
})

type ProductFormValues = z.infer<typeof productSchema>

export function ProductForm() {
    // const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: "",
            code: "",
            type: 1,
            unit: "Unit",
            sellPrice: 0,
            buyPrice: 0,
            trackInventory: true,
            stockOnHand: 0,
            reorderLevel: 5,
            isActive: true,
        },
    })

    const watchType = form.watch("type");
    const watchTrackInventory = form.watch("trackInventory");

    async function onSubmit(data: ProductFormValues) {
        try {
            setIsSubmitting(true);
            await apiClient.post("/Products", data); // Direct call or add createProduct to apiClient
            toast.success("Product created successfully");
            window.location.href = "/dashboard/inventory";
        } catch (error) {
            console.error("Failed to create product", error);
            toast.error("Failed to create product");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card/60 p-6 rounded-xl border border-foreground/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Product Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Wireless Mouse" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Code (SKU)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Leave empty for auto-generate" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                                onValueChange={(val) => field.onChange(parseInt(val))}
                                defaultValue={field.value.toString()}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="1">Product (Stocked)</SelectItem>
                                    <SelectItem value="0">Service (Non-stocked)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit</FormLabel>
                                <FormControl>
                                    <Input placeholder="Pcs, Box, Hr" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="buyPrice"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Buy Price (Cost)</FormLabel>
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
                        name="sellPrice"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sell Price</FormLabel>
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
                </div>

                {watchType === 1 && (
                    <div className="space-y-4 border rounded p-4 bg-zinc-50">
                        <FormField
                            control={form.control}
                            name="trackInventory"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            Track Inventory
                                        </FormLabel>
                                        <FormDescription>
                                            Keep track of stock levels for this item.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {watchTrackInventory && (
                            <div className="grid grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="stockOnHand"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Opening Stock</FormLabel>
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
                                    name="reorderLevel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Reorder Level</FormLabel>
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
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" type="button" onClick={() => window.history.back()} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Product
                    </Button>
                </div>
            </form>
        </Form>
    )
}
