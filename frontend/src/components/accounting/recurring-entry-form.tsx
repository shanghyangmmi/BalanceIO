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
import { Checkbox } from "@/components/ui/checkbox"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { Account } from "@/lib/types/accounting"
import { toast } from "sonner"
import { AccountCombobox } from "@/components/accounting/account-combobox"

const recurringEntrySchema = z.object({
    description: z.string().min(1, "Description is required"),
    reference: z.string().optional(),
    frequency: z.coerce.number().min(0).max(4), // 0=Daily, 1=Weekly, 2=Monthly...
    nextRunDate: z.string().min(1, "Start/Next Run Date is required"),
    endDate: z.string().optional(),
    lines: z.array(z.object({
        accountId: z.string().min(1, "Account is required"),
        description: z.string().optional(),
        debit: z.number().min(0),
        credit: z.number().min(0),
    })).min(2, "At least two lines are required")
        .refine(
            (lines) => {
                const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0)
                const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0)
                // Allow small floating point diff
                return Math.abs(totalDebit - totalCredit) < 0.01
            },
            { message: "Total Debit must equal Total Credit" }
        )
})

type RecurringEntryFormValues = z.infer<typeof recurringEntrySchema>

interface RecurringEntryFormProps {
    defaultValues?: Partial<RecurringEntryFormValues>
    onSubmit: (data: RecurringEntryFormValues) => void
    isSubmitting?: boolean
}

export function RecurringEntryForm({ defaultValues, onSubmit, isSubmitting }: RecurringEntryFormProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);

    // Default next run to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const form = useForm<any>({
        resolver: zodResolver(recurringEntrySchema),
        defaultValues: {
            description: defaultValues?.description || "",
            reference: defaultValues?.reference || "",
            frequency: defaultValues?.frequency ?? 2, // Monthly default
            nextRunDate: defaultValues?.nextRunDate || tomorrow.toISOString().split('T')[0],
            endDate: defaultValues?.endDate || "",
            lines: defaultValues?.lines || [
                { accountId: "", description: "", debit: 0, credit: 0 },
                { accountId: "", description: "", debit: 0, credit: 0 }
            ],
        } as any,
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    })

    const formValues = useWatch({ control: form.control });

    const totalDebit = formValues.lines?.reduce((sum: number, line: any) => sum + (Number(line.debit) || 0), 0) || 0;
    const totalCredit = formValues.lines?.reduce((sum: number, line: any) => sum + (Number(line.credit) || 0), 0) || 0;
    const difference = totalDebit - totalCredit;
    const isBalanced = Math.abs(difference) < 0.01;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-card/60 rounded-xl border border-foreground/10">
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>Description / Template Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Monthly Rent" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="frequency"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Frequency</FormLabel>
                                <Select
                                    onValueChange={(val) => field.onChange(parseInt(val))}
                                    defaultValue={field.value.toString()}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Frequency" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="0">Daily</SelectItem>
                                        <SelectItem value="1">Weekly</SelectItem>
                                        <SelectItem value="2">Monthly</SelectItem>
                                        <SelectItem value="3">Quarterly</SelectItem>
                                        <SelectItem value="4">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="nextRunDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Next Run Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>End Date (Optional)</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reference</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. REF-AUTO" {...field} />
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
                                <TableHead className="w-[300px]">Account</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[150px]">Debit</TableHead>
                                <TableHead className="w-[150px]">Credit</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((fieldItem, index) => (
                                <TableRow key={fieldItem.id}>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.accountId`}
                                            render={({ field }) => (
                                                <AccountCombobox
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.description`}
                                            render={({ field }) => (
                                                <Input {...field} placeholder="Line description" />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.debit`}
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    {...field}
                                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                    disabled={form.watch(`lines.${index}.credit`) > 0}
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.credit`}
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    {...field}
                                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                    disabled={form.watch(`lines.${index}.debit`) > 0}
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            type="button"
                                            onClick={() => remove(index)}
                                            disabled={fields.length <= 2}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <div className="p-4 border-t flex items-center justify-between bg-zinc-50 dark:bg-white/5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({ accountId: "", description: "", debit: 0, credit: 0 })}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Line
                        </Button>

                        <div className="flex gap-8 text-sm font-medium">
                            <div className="flex gap-2">
                                <span className="text-muted-foreground">Total Debit:</span>
                                <span>{formatCurrency(totalDebit)}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-muted-foreground">Total Credit:</span>
                                <span>{formatCurrency(totalCredit)}</span>
                            </div>
                            <div className={cn("flex gap-2", !isBalanced ? "text-red-500 font-bold" : "text-emerald-500")}>
                                <span>Difference:</span>
                                <span>{formatCurrency(Math.abs(difference))}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    {/* Handle Cancel in parent or add onCancel prop */}
                    <Button type="submit" disabled={isSubmitting || !isBalanced}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Template
                    </Button>
                </div>
            </form>
        </Form>
    )
}
