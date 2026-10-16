"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, UploadCloud } from "lucide-react"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils/formatter"

const expenseClaimSchema = z.object({
    employeeName: z.string().min(1, "Employee name is required"),
    date: z.string().min(1, "Date is required"),
    description: z.string().optional(),
    items: z.array(z.object({
        category: z.string().min(1, "Category is required"),
        description: z.string().min(1, "Description is required"),
        amount: z.number().min(0),
    })).min(1, "At least one item is required")
})

type ExpenseClaimValues = z.infer<typeof expenseClaimSchema>

const EXPENSE_CATEGORIES = [
    { id: "travel", name: "Travel & Transport" },
    { id: "meals", name: "Meals & Entertainment" },
    { id: "supplies", name: "Office Supplies" },
    { id: "accommodation", name: "Accommodation" },
    { id: "other", name: "Other" },
]

export function ExpenseClaimForm() {
    const form = useForm<ExpenseClaimValues>({
        resolver: zodResolver(expenseClaimSchema),
        defaultValues: {
            employeeName: "",
            date: new Date().toISOString().split('T')[0],
            items: [
                { category: "", description: "", amount: 0 }
            ],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const totalAmount = form.watch("items").reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    function onSubmit(data: ExpenseClaimValues) {
        alert("Expense Claim Submitted!");
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">New Expense Claim</h3>
                    <p className="text-sm text-muted-foreground">Submit a claim for reimbursement.</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Claim</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalAmount)}</p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="employeeName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Employee Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Claim Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
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
                                    <TableHead className="w-[200px]">Category</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-[150px]">Amount</TableHead>
                                    <TableHead className="w-[120px]">Receipt</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((fieldItem, index) => (
                                    <TableRow key={fieldItem.id}>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.category`}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Category" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {EXPENSE_CATEGORIES.map((cat) => (
                                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
                                                    <Input {...field} placeholder="Details" />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.amount`}
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
                                            <Button variant="outline" size="sm" type="button" className="w-full">
                                                <UploadCloud className="w-4 h-4 mr-2" /> Upload
                                            </Button>
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
                                ))}
                            </TableBody>
                        </Table>
                        <div className="p-4 border-t bg-zinc-50 dark:bg-white/5">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ category: "", description: "", amount: 0 })}
                            >
                                <Plus className="h-4 w-4 mr-2" /> Add Expense
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="submit" size="lg">
                            Submit Claim
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
