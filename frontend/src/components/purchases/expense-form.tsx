"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
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
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
// const router = useRouter();
import { ProjectSelect } from "@/components/projects/project-select"

const expenseSchema = z.object({
    date: z.string().min(1, "Date is required"),
    description: z.string().min(1, "Description is required"),
    amount: z.number().min(1, "Amount must be greater than 0"),
    expenseAccountCode: z.string().min(1, "Expense Account is required"),
    paymentAccountCode: z.string().min(1, "Payment Account is required"),
    projectId: z.string().optional(),
})

type ExpenseFormValues = z.infer<typeof expenseSchema>

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
}

export function ExpenseForm() {

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            description: "",
            amount: 0,
            expenseAccountCode: "",
            paymentAccountCode: "",
            projectId: "",
        },
    })

    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const accountsData = await apiClient.getAccounts();
                setAccounts(accountsData);
            } catch (error) {
                console.error("Failed to load accounts", error);
                toast.error("Failed to load accounts");
            } finally {
                setIsLoadingData(false);
            }
        };
        loadDependencies();
    }, []);

    // Filter accounts
    const expenseAccounts = accounts.filter(a => a.code.startsWith('5') || a.code.startsWith('6'));
    // Payment accounts: usually Assets (1xxx) - Cash, Bank
    const paymentAccounts = accounts.filter(a => a.code.startsWith('1') && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));

    async function onSubmit(data: ExpenseFormValues) {
        try {
            setIsSubmitting(true);
            await apiClient.createExpense({
                ...data,
                date: data.date, // API expects DateOnly or string, client sends YYYY-MM-DD which works
            });
            toast.success("Expense created successfully");
            window.location.href = "/dashboard/expenses";
        } catch (error) {
            console.error("Failed to create expense", error);
            toast.error("Failed to create expense");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoadingData) {
        return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-card/60 p-6 rounded-xl border border-foreground/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount</FormLabel>
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
                                    className="bg-white"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Office Supplies" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="expenseAccountCode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Expense Account</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Account" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {expenseAccounts.map((a) => (
                                            <SelectItem key={a.id} value={a.code}>{a.code} - {a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="paymentAccountCode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Paid From</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Account" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {paymentAccounts.map((a) => (
                                            <SelectItem key={a.id} value={a.code}>{a.code} - {a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" type="button" onClick={() => window.history.back()} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Expense
                    </Button>
                </div>
            </form>
        </Form>
    )
}
