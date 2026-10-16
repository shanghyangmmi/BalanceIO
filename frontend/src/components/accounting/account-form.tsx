"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { Account, accountGroupLabels } from "@/lib/types/accounting"

const accountFormSchema = z.object({
    code: z.string().min(1, {
        message: "Account code is required.",
    }),
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    type: z.enum(["Asset", "Liability", "Equity", "Sales", "CostOfSales", "Expense", "OtherIncomeExpense"]),
    parentId: z.string().optional(),
    description: z.string().optional(),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

interface AccountFormProps {
    accounts: Account[];
    defaultValues?: Partial<AccountFormValues>
    onSubmit: (data: any) => void
    onCancel?: () => void
}

export function AccountForm({ accounts, defaultValues, onSubmit, onCancel }: AccountFormProps) {
    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountFormSchema),
        defaultValues: defaultValues || {
            code: "",
            name: "",
            type: "Asset",
            description: "",
            parentId: "none",
        },
    })

    const selectedType = form.watch("type")
    const selectedParentId = form.watch("parentId")

    // Filter potential parents: same group, active, level < 5
    const potentialParents = accounts.filter(
        (a) =>
            a.accountGroup === selectedType &&
            a.isActive !== false &&
            a.level < 5
    );

    // Calculate the level for the new account
    const computedLevel = (() => {
        if (!selectedParentId || selectedParentId === "none") return 1;
        const parent = accounts.find((a) => a.id === selectedParentId);
        return parent ? parent.level + 1 : 1;
    })();

    function handleSubmit(data: AccountFormValues) {
        const parentId = data.parentId === "none" ? undefined : data.parentId;
        const parent = parentId ? accounts.find((a) => a.id === parentId) : undefined;

        // Map to backend model
        const payload: any = {
            code: data.code,
            name: data.name,
            type: getBackendType(data.type),
            accountGroup: data.type,
            level: parent ? parent.level + 1 : 1,
            isHeader: false,
            normalBalance: getNormalBalance(data.type),
            description: data.description || null,
            parentAccountId: parentId || null,
            isActive: true,
        };

        onSubmit(payload);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Account Code</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. 1-1001" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Account Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Kas Besar" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Account Group</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select group" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Object.entries(accountGroupLabels).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: config.color }}
                                                    />
                                                    {config.label}
                                                </div>
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
                        name="parentId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Parent Account</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || "none"}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select parent" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">None (Top Level)</SelectItem>
                                        {potentialParents
                                            .sort((a, b) => a.code.localeCompare(b.code))
                                            .map((account) => (
                                                <SelectItem key={account.id} value={account.id}>
                                                    <span className="font-mono text-xs mr-2">{account.code}</span>
                                                    {account.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    Level: {computedLevel} / 5
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Additional details (optional)..."
                                    className="resize-none"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end space-x-2 pt-4">
                    {onCancel && (
                        <Button variant="outline" type="button" onClick={onCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button type="submit">Save Account</Button>
                </div>
            </form>
        </Form>
    )
}

function getBackendType(group: string): string {
    switch (group) {
        case "Asset": return "Asset";
        case "Liability": return "Liability";
        case "Equity": return "Equity";
        case "Sales": return "Revenue";
        case "CostOfSales": return "Expense";
        case "Expense": return "Expense";
        case "OtherIncomeExpense": return "Revenue";
        default: return "Asset";
    }
}

function getNormalBalance(group: string): string {
    switch (group) {
        case "Asset":
        case "CostOfSales":
        case "Expense":
            return "Debit";
        default:
            return "Credit";
    }
}
