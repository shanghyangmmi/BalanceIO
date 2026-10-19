"use client"

import { WarehouseSelect } from "@/components/inventory/warehouse-select"
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
import { Checkbox } from "@/components/ui/checkbox"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { Contact, Product } from "@/lib/types/sales"
import { toast } from "sonner"
// import { useRouter } from "next/navigation"
import { ProjectSelect } from "@/components/projects/project-select"

const invoiceSchema = z.object({
    customerId: z.string().min(1, "Customer is required"),
    date: z.string().min(1, "Date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    projectId: z.string().optional(),
    currency: z.string(),
    exchangeRate: z.number(),
    items: z.array(z.object({
        productId: z.string().min(1, "Product is required"),
        description: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        taxRate: z.number().min(0), // 11 for 11%
        discount: z.number().min(0), // Fixed amount
    })).min(1, "At least one item is required")
})

type InvoiceFormValues = z.infer<typeof invoiceSchema>

export function InvoiceForm() {
    // const router = useRouter();
    const [customers, setCustomers] = useState<Contact[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [warehouseId, setWarehouseId] = useState("");

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            customerId: "",
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
            projectId: "",
            currency: "IDR",
            exchangeRate: 1,
            items: [
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
                setCustomers(contactsData.filter(c => c.type === 'Customer'));
                setProducts(productsData);
            } catch (error) {
                console.error("Failed to load dependencies", error);
                toast.error("Failed to load customers or products");
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

    // Handle currency spot rate lookup on date or currency change
    useEffect(() => {
        const fetchRate = async () => {
            const curr = formValues.currency;
            const date = formValues.date;
            if (curr && curr !== "IDR" && date) {
                try {
                    const rate = await apiClient.getExchangeMiddleRate(date, curr);
                    if (rate && rate > 0) {
                        form.setValue("exchangeRate", rate);
                    }
                } catch (e) {
                    // Fallback to existing or manual
                }
            } else if (curr === "IDR") {
                form.setValue("exchangeRate", 1);
            }
        };
        fetchRate();
    }, [formValues.currency, formValues.date]);

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

            // Tax calculation (Backend uses rate like 11.0 for 11%)
            const rate = Number(item.taxRate) || 0;
            taxTotal += lineAmount * (rate / 100);
        });

        return { subtotal, taxTotal, total: subtotal + taxTotal };
    };

    const { subtotal, taxTotal, total } = calculateTotals();

    async function onSubmit(data: InvoiceFormValues) {
        try {
            setIsSubmitting(true);

            // Map form data to Backend DTO
            const payload = {
                contactId: data.customerId,
                invoiceDate: data.date,
                dueDate: data.dueDate,
                projectId: data.projectId || null,
                warehouseId: warehouseId || null,
                billingAddress: customers.find(c => c.id === data.customerId)?.address || "",
                currency: data.currency || "IDR",
                exchangeRate: data.currency === "IDR" ? 1 : (Number(data.exchangeRate) || 1),
                lines: data.items.map(item => ({
                    productId: item.productId,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountAmount: item.discount, // Sending Fixed Amount
                    discountPercent: 0,
                    taxRate: item.taxRate,
                    isTaxable: item.taxRate > 0
                }))
            };

            await apiClient.createInvoice(payload);
            toast.success("Invoice created successfully");
            window.location.href = "/dashboard/sales/invoices";
        } catch (error) {
            console.error("Failed to create invoice", error);
            toast.error("Failed to create invoice");
        } finally {
            setIsSubmitting(false);
        }
    }

    // Handle Product Change
    const updateLineOnProductChange = (index: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            form.setValue(`items.${index}.unitPrice`, product.salePrice);
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-card/60 rounded-xl border border-foreground/10">
                    <FormField
                        control={form.control}
                        name="customerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Customer" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {customers.map((c) => (
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
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Due Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <WarehouseSelect value={warehouseId} onChange={setWarehouseId} />
                    <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Project / Cost Center</FormLabel>
                                <FormControl>
                                    <ProjectSelect
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Currency</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Currency" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="IDR">IDR · Indonesian Rupiah</SelectItem>
                                        <SelectItem value="USD">USD · US Dollar</SelectItem>
                                        <SelectItem value="EUR">EUR · Euro</SelectItem>
                                        <SelectItem value="SGD">SGD · Singapore Dollar</SelectItem>
                                        <SelectItem value="JPY">JPY · Japanese Yen</SelectItem>
                                        <SelectItem value="GBP">GBP · British Pound</SelectItem>
                                        <SelectItem value="AUD">AUD · Australian Dollar</SelectItem>
                                        <SelectItem value="CNY">CNY · Chinese Yuan</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {formValues.currency !== "IDR" && (
                        <FormField
                            control={form.control}
                            name="exchangeRate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Spot Rate (JISDOR / IDR)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="any"
                                            value={field.value || ""}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                            className="font-mono font-bold"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                <div className="rounded-md border bg-white dark:bg-zinc-900/50">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">Product / Service</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[80px]">Qty</TableHead>
                                <TableHead className="w-[150px]">Price</TableHead>

                                <TableHead className="w-[100px]">Discount</TableHead>
                                <TableHead className="w-[80px]">Tax %</TableHead>
                                <TableHead className="w-[150px] text-right">Total</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((fieldItem, index) => {
                                // Watch specific fields for inline total calculation
                                const qty = form.watch(`items.${index}.quantity`) || 0;
                                const price = form.watch(`items.${index}.unitPrice`) || 0;
                                const discount = form.watch(`items.${index}.discount`) || 0;
                                const lineTotal = (qty * price) - discount;

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
                        Create Invoice
                    </Button>
                </div>
            </form>
        </Form>
    )
}
