"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { CalendarIcon, Plus, Trash2, Loader2, Save } from "lucide-react"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils/formatter"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { Contact, Product } from "@/lib/types/sales"
import { toast } from "sonner"
import { ProjectSelect } from "@/components/projects/project-select"

const orderSchema = z.object({
    vendorId: z.string().min(1, "Vendor is required"),
    reference: z.string().optional(),
    orderDate: z.string().min(1, "Order Date is required"),
    deliveryDate: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        productId: z.string().min(1, "Product is required"),
        description: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        taxRate: z.number().min(0),
        discount: z.number().min(0),
    })).min(1, "At least one item is required")
})

type OrderFormValues = z.infer<typeof orderSchema>

export function OrderForm({ existingOrder }: { existingOrder?: any }) {
    const [vendors, setVendors] = useState<Contact[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<OrderFormValues>({
        resolver: zodResolver(orderSchema),
        defaultValues: {
            vendorId: existingOrder?.contactId || "",
            reference: existingOrder?.reference || "",
            orderDate: existingOrder?.orderDate ? new Date(existingOrder.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            deliveryDate: existingOrder?.deliveryDate ? new Date(existingOrder.deliveryDate).toISOString().split('T')[0] : "",
            notes: existingOrder?.notes || "",
            items: existingOrder?.lines?.map((l: any) => ({
                productId: l.productId,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discount: l.discountAmount || 0,
                taxRate: l.taxRate || 0
            })) || [
                    { productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 11, discount: 0 }
                ],
        },
    })

    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const [contactsData, productsData] = await Promise.all([
                    apiClient.getContacts(),
                    apiClient.getProducts()
                ]);
                setVendors(contactsData.filter(c => c.type === 1 || c.type === 2)); // 1=Vendor, 2=Both
                setProducts(productsData);
            } catch (error) {
                console.error("Failed to load dependencies", error);
                toast.error("Failed to load vendors or products");
            } finally {
                setIsLoadingData(false);
            }
        };
        loadDependencies();
    }, []);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const formValues = useWatch({ control: form.control });

    // Calculate Totals
    const calculateTotals = () => {
        let subtotal = 0;
        let taxTotal = 0;

        formValues.items?.forEach(item => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unitPrice) || 0;
            const discount = Number(item.discount) || 0;
            const lineAmount = (qty * price) - discount;

            subtotal += lineAmount;

            const rate = Number(item.taxRate) || 0;
            taxTotal += lineAmount * (rate / 100);
        });

        return { subtotal, taxTotal, total: subtotal + taxTotal };
    };

    const { subtotal, taxTotal, total } = calculateTotals();

    async function onSubmit(data: OrderFormValues) {
        try {
            setIsSubmitting(true);

            // Map form data to Backend DTO
            const payload = {
                id: existingOrder?.id,
                contactId: data.vendorId,
                reference: data.reference,
                orderDate: data.orderDate,
                deliveryDate: data.deliveryDate ? data.deliveryDate : null,
                notes: data.notes,
                currency: "IDR",
                totalAmount: total, // Optional, backend might recalc
                lines: data.items.map(item => ({
                    productId: item.productId,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountAmount: item.discount, // Sending Fixed Amount
                    discountPercent: 0,
                    taxRate: item.taxRate,
                    total: ((item.quantity * item.unitPrice) - item.discount) * (1 + item.taxRate / 100)
                }))
            };

            if (existingOrder) {
                await apiClient.updatePurchaseOrder(existingOrder.id, payload);
                toast.success("Order updated successfully");
            } else {
                await apiClient.createPurchaseOrder(payload);
                toast.success("Order created successfully");
            }

            window.location.href = "/dashboard/purchases/orders";
        } catch (error) {
            console.error("Failed to save order", error);
            toast.error("Failed to save order");
        } finally {
            setIsSubmitting(false);
        }
    }

    // Handle Product Change
    const updateLineOnProductChange = (index: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            // Use cost price if available, else sale price as fallback or 0
            const costPrice = (product as any).purchasePrice || product.salePrice || 0;
            form.setValue(`items.${index}.unitPrice`, costPrice);
            form.setValue(`items.${index}.description`, product.description || product.name);
            form.setValue(`items.${index}.taxRate`, product.isTaxable ? 11 : 0);
        }
    };

    if (isLoadingData) {
        return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-white dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-white/10 shadow-sm">
                    <FormField
                        control={form.control}
                        name="vendorId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Vendor</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!existingOrder && existingOrder.status !== 0}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Vendor" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {vendors.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reference #</FormLabel>
                                <FormControl>
                                    <Input placeholder="PO-Ref" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="orderDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Order Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="deliveryDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Expected Delivery</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                    <Input placeholder="Optional notes..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="rounded-md border bg-white dark:bg-zinc-900/50">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">Product / Service</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[80px]">Qty</TableHead>
                                <TableHead className="w-[150px]">Cost</TableHead>

                                <TableHead className="w-[100px]">Discount</TableHead>
                                <TableHead className="w-[80px]">Tax %</TableHead>
                                <TableHead className="w-[150px] text-right">Total</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((fieldItem, index) => {
                                const lineTotal = ((form.watch(`items.${index}.quantity`) || 0) * (form.watch(`items.${index}.unitPrice`) || 0)) - (form.watch(`items.${index}.discount`) || 0);

                                return (
                                    <TableRow key={fieldItem.id}>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.productId`}
                                                render={({ field }) => (
                                                    <Select onValueChange={(val) => {
                                                        field.onChange(val);
                                                        updateLineOnProductChange(index, val);
                                                    }} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Item" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {products.map((p) => (
                                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.description`}
                                                render={({ field }) => (
                                                    <Input {...field} placeholder="Description" />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.quantity`}
                                                render={({ field }) => (
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.unitPrice`}
                                                render={({ field }) => (
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.discount`}
                                                render={({ field }) => (
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.taxRate`}
                                                render={({ field }) => (
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                        className="w-16"
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {formatCurrency(lineTotal)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                type="button"
                                                onClick={() => remove(index)}
                                                disabled={fields.length <= 1}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    <div className="p-4 border-t flex items-start justify-between bg-zinc-50 dark:bg-white/5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ productId: "", description: "", quantity: 1, unitPrice: 0, taxRate: 11, discount: 0 })}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Item
                        </Button>

                        <div className="w-[300px] space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span>{formatCurrency(taxTotal)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                                <span>Total</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" type="button" onClick={() => window.history.back()} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {existingOrder ? "Update Order" : "Create Order"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
