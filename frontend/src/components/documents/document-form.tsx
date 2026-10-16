"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Loader2, Save, ArrowLeft } from "lucide-react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/formatter"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ProjectSelect } from "@/components/projects/project-select"

// --- Types ---
export type DocFormType = "sales-invoice" | "purchase-order" | "purchase-bill"

interface DocFormConfig {
    title: string
    counterpartyLabel: string
    counterpartyType: "Customer" | "Vendor"
    dateLabel: string
    showDueDate: boolean
    showDeliveryDate: boolean
    submitLabel: string
    color: string
}

const formConfigs: Record<DocFormType, DocFormConfig> = {
    "sales-invoice": {
        title: "Sales Invoice",
        counterpartyLabel: "Customer",
        counterpartyType: "Customer",
        dateLabel: "Invoice Date",
        showDueDate: true,
        showDeliveryDate: false,
        submitLabel: "Create Invoice",
        color: "#0B3C3D",
    },
    "purchase-order": {
        title: "Purchase Order",
        counterpartyLabel: "Vendor",
        counterpartyType: "Vendor",
        dateLabel: "Order Date",
        showDueDate: false,
        showDeliveryDate: true,
        submitLabel: "Create Purchase Order",
        color: "#3b82f6",
    },
    "purchase-bill": {
        title: "Purchase Bill",
        counterpartyLabel: "Vendor",
        counterpartyType: "Vendor",
        dateLabel: "Bill Date",
        showDueDate: true,
        showDeliveryDate: false,
        submitLabel: "Create Purchase Bill",
        color: "#ef4444",
    },
}

// --- Schema ---
const documentSchema = z.object({
    contactId: z.string().min(1, "Counterparty is required"),
    date: z.string().min(1, "Date is required"),
    dueDate: z.string().optional(),
    deliveryDate: z.string().optional(),
    projectId: z.string().optional(),
    notes: z.string().optional(),
    items: z
        .array(
            z.object({
                productId: z.string().min(1, "Product is required"),
                description: z.string().optional(),
                quantity: z.number().min(1),
                unitPrice: z.number().min(0),
                taxRate: z.number().min(0),
                discount: z.number().min(0),
            })
        )
        .min(1, "At least one item is required"),
})

type DocumentFormValues = z.infer<typeof documentSchema>

// --- Props ---
interface DocumentFormProps {
    type: DocFormType
    onSuccess?: () => void
}

export function DocumentForm({ type, onSuccess }: DocumentFormProps) {
    const router = useRouter()
    const config = formConfigs[type]
    const [contacts, setContacts] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [isLoadingData, setIsLoadingData] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const today = new Date().toISOString().split("T")[0]
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]

    const form = useForm<DocumentFormValues>({
        resolver: zodResolver(documentSchema),
        defaultValues: {
            contactId: "",
            date: today,
            dueDate: config.showDueDate ? thirtyDaysLater : "",
            deliveryDate: config.showDeliveryDate ? thirtyDaysLater : "",
            projectId: "",
            notes: "",
            items: [
                {
                    productId: "",
                    description: "",
                    quantity: 1,
                    unitPrice: 0,
                    taxRate: 11,
                    discount: 0,
                },
            ],
        },
    })

    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const [contactsData, productsData] = await Promise.all([
                    apiClient.getContacts(config.counterpartyType),
                    apiClient.getProducts(),
                ])
                setContacts(contactsData)
                setProducts(productsData)
            } catch (error) {
                console.error("Failed to load dependencies", error)
                toast.error("Failed to load form data")
            } finally {
                setIsLoadingData(false)
            }
        }
        loadDependencies()
    }, [config.counterpartyType])

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const formValues = useWatch({ control: form.control })

    // Calculate totals
    const calculateTotals = () => {
        let subtotal = 0
        let taxTotal = 0

        formValues.items?.forEach((item) => {
            const qty = Number(item.quantity) || 0
            const price = Number(item.unitPrice) || 0
            const discount = Number(item.discount) || 0
            const lineAmount = qty * price - discount
            subtotal += lineAmount
            const rate = Number(item.taxRate) || 0
            taxTotal += lineAmount * (rate / 100)
        })

        return { subtotal, taxTotal, total: subtotal + taxTotal }
    }

    const { subtotal, taxTotal, total } = calculateTotals()

    // Handle product change → auto-fill price
    const updateLineOnProductChange = (index: number, productId: string) => {
        const product = products.find((p: any) => p.id === productId)
        if (product) {
            const price =
                type === "sales-invoice" ? product.salePrice : product.purchasePrice || product.salePrice
            form.setValue(`items.${index}.unitPrice`, price || 0)
            form.setValue(
                `items.${index}.description`,
                product.description || product.name
            )
            form.setValue(
                `items.${index}.taxRate`,
                product.isTaxable ? 11 : 0
            )
        }
    }

    async function onSubmit(data: DocumentFormValues) {
        try {
            setIsSubmitting(true)

            if (type === "sales-invoice") {
                const payload = {
                    contactId: data.contactId,
                    invoiceDate: data.date,
                    dueDate: data.dueDate,
                    projectId: data.projectId || null,
                    billingAddress:
                        contacts.find((c) => c.id === data.contactId)?.address || "",
                    currency: "IDR",
                    exchangeRate: 1,
                    notes: data.notes || "",
                    lines: data.items.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discountAmount: item.discount,
                        discountPercent: 0,
                        taxRate: item.taxRate,
                        isTaxable: item.taxRate > 0,
                    })),
                }
                await apiClient.createInvoice(payload)
                toast.success("Invoice created successfully")
            } else if (type === "purchase-order") {
                const payload = {
                    contactId: data.contactId,
                    orderDate: data.date,
                    expectedDeliveryDate: data.deliveryDate,
                    projectId: data.projectId || null,
                    currency: "IDR",
                    exchangeRate: 1,
                    notes: data.notes || "",
                    lines: data.items.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discountAmount: item.discount,
                        discountPercent: 0,
                        taxRate: item.taxRate,
                        isTaxable: item.taxRate > 0,
                    })),
                }
                await apiClient.createPurchaseOrder(payload)
                toast.success("Purchase Order created successfully")
            } else if (type === "purchase-bill") {
                const payload = {
                    contactId: data.contactId,
                    billDate: data.date,
                    dueDate: data.dueDate,
                    projectId: data.projectId || null,
                    currency: "IDR",
                    exchangeRate: 1,
                    notes: data.notes || "",
                    lines: data.items.map((item) => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discountAmount: item.discount,
                        discountPercent: 0,
                        taxRate: item.taxRate,
                        isTaxable: item.taxRate > 0,
                    })),
                }
                await apiClient.createPurchaseBill(payload)
                toast.success("Purchase Bill created successfully")
            }

            if (onSuccess) {
                onSuccess()
            } else {
                router.push("/dashboard/documents")
            }
        } catch (error) {
            console.error("Failed to create document", error)
            toast.error(`Failed to create ${config.title.toLowerCase()}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoadingData) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Header Info */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-3">
                            <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: config.color }}
                            >
                                {config.title
                                    .split(" ")
                                    .map((w) => w[0])
                                    .join("")}
                            </div>
                            {config.title} Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="contactId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{config.counterpartyLabel}</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={`Select ${config.counterpartyLabel}`}
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {contacts.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.name}
                                                    </SelectItem>
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
                                        <FormLabel>{config.dateLabel}</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {config.showDueDate && (
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
                            )}

                            {config.showDeliveryDate && (
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
                            )}

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
                        </div>
                    </CardContent>
                </Card>

                {/* Line Items */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle>Line Items</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="rounded-md border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[220px]">
                                            Product / Service
                                        </TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[80px]">Qty</TableHead>
                                        <TableHead className="w-[140px]">Price</TableHead>
                                        <TableHead className="w-[100px]">Discount</TableHead>
                                        <TableHead className="w-[80px]">Tax %</TableHead>
                                        <TableHead className="w-[140px] text-right">
                                            Total
                                        </TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((fieldItem, index) => {
                                        const qty = form.watch(`items.${index}.quantity`) || 0
                                        const price = form.watch(`items.${index}.unitPrice`) || 0
                                        const discount = form.watch(`items.${index}.discount`) || 0
                                        const lineTotal = qty * price - discount

                                        return (
                                            <TableRow key={fieldItem.id}>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`items.${index}.productId`}
                                                        render={({ field }) => (
                                                            <Select
                                                                onValueChange={(val) => {
                                                                    field.onChange(val)
                                                                    updateLineOnProductChange(index, val)
                                                                }}
                                                                defaultValue={field.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select Item" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {products.map((p: any) => (
                                                                        <SelectItem key={p.id} value={p.id}>
                                                                            {p.name}
                                                                        </SelectItem>
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
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        parseFloat(e.target.value) || 0
                                                                    )
                                                                }
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
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        parseFloat(e.target.value) || 0
                                                                    )
                                                                }
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
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        parseFloat(e.target.value) || 0
                                                                    )
                                                                }
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
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        parseFloat(e.target.value) || 0
                                                                    )
                                                                }
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
                                    onClick={() =>
                                        append({
                                            productId: "",
                                            description: "",
                                            quantity: 1,
                                            unitPrice: 0,
                                            taxRate: 11,
                                            discount: 0,
                                        })
                                    }
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
                    </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                    <CardContent className="pt-6">
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes / Remarks</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            placeholder="Any additional notes for this document..."
                                            rows={3}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => router.push("/dashboard/documents")}
                        disabled={isSubmitting}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        style={{ backgroundColor: config.color }}
                        className="hover:opacity-90"
                    >
                        {isSubmitting && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Save className="mr-2 h-4 w-4" />
                        {config.submitLabel}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
