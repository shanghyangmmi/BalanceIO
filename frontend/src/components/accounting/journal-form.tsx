"use client"

import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import * as z from "zod"
import { CalendarIcon, Plus, Trash2, Loader2, Hash, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiClient, ApiError } from "@/lib/api-client"
import { journalKeys } from "@/hooks/use-journal-entries"
import { attachmentKeys } from "@/hooks/use-attachments"
import { balanceOf, isStorableAmount, minorToNumber } from "@/lib/utils/minor-units"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { JournalEntry } from "@/lib/types/accounting"
import { useCompany } from "@/contexts/company-context"
import { retryUnlessClientError } from "@/lib/query-retry"

// UI COMPONENTS
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form"
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
import { AccountCombobox } from "@/components/accounting/account-combobox"
import { JournalAttachments, JOURNAL_ATTACHMENT_TYPE } from "@/components/accounting/journal-attachments"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

// --- UTILS ---
// --- UTILS ---

// PREMIUM NUMERIC INPUT
interface NumericInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: number | string;
    onValueChange: (val: number) => void;
}

const NumericInput = ({ value, onValueChange, className, disabled, ...props }: NumericInputProps) => {
    const format = (num: number | string) => {
        if (!num && num !== 0) return "";
        const parts = num.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    }

    const [displayValue, setDisplayValue] = useState(format(value));

    useEffect(() => {
        setDisplayValue(format(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/,/g, "");
        if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
            setDisplayValue(e.target.value);
            const parsed = parseFloat(raw);
            if (!isNaN(parsed)) {
                onValueChange(parsed);
            } else {
                onValueChange(0);
            }
        }
    };

    const handleBlur = () => {
        setDisplayValue(format(value));
    };

    return (
        <Input
            {...props}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            className={cn(
                "font-mono text-right tabular-nums bg-transparent border-transparent focus:bg-cyan-50/50 focus:border-cyan-200 focus:ring-2 focus:ring-cyan-100 transition-all",
                className
            )}
        />
    )
}

// --- SCHEMA ---
const journalSchema = z.object({
    date: z.string().min(1, "Required"),
    referenceNumber: z.string().optional(),
    tags: z.string().optional(),
    contactId: z.string().optional(),
    currency: z.string().default("IDR"),
    exchangeRate: z.number().default(1),
    notes: z.string().optional(),
    isAdjustingEntry: z.boolean().default(false),
    lines: z.array(z.object({
        accountId: z.string().min(1, "Required"),
        description: z.string().optional(),
        debit: z.number().min(0).refine(isStorableAmount, "At most 4 decimal places"),
        credit: z.number().min(0).refine(isStorableAmount, "At most 4 decimal places"),
        tax: z.array(z.string()).default([]),
    })).min(2).refine((data) => {
        return data.every(line => (line.debit || 0) > 0 || (line.credit || 0) > 0);
    }, { message: "Value required", path: ["debit"] })
}).refine((data) => balanceOf(data.lines).balanced, {
    // Exact, like the API: a difference of one sen is still unbalanced.
    message: "Total debits must equal total credits",
    path: ["lines"],
});

type JournalFormValues = z.infer<typeof journalSchema>

interface JournalFormProps {
    initialData?: JournalEntry | null;
}

export function JournalForm({ initialData }: JournalFormProps) {
    const can = useCan();
    // Saving an existing entry is an edit; posting needs Finance.Create as well.
    // Without either, the form is a read-only view.
    const canSave = initialData ? can(PERMISSIONS.FinanceEdit) : can(PERMISSIONS.FinanceCreate);
    const canPost = canSave && can(PERMISSIONS.FinanceCreate);
    // Files go up when the entry is saved, through endpoints that want
    // Finance.Create to upload and Finance.Edit to delete. The API keeps
    // evidence on a posted entry, so removal is for drafts only.
    const canAttach = canSave && can(PERMISSIONS.FinanceCreate);
    const canRemoveAttachments = !!initialData && initialData.status === "DRAFT" && canSave && can(PERMISSIONS.FinanceEdit);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const queryClient = useQueryClient();
    const router = useRouter();
    const { company } = useCompany();
    // The company's own contacts: the id chosen here is stored on the entry.
    const { data: contacts = [] } = useQuery({
        queryKey: ["contacts", company?.id],
        queryFn: () => apiClient.get<{ id: string; name: string; code: string }[]>("/Contacts"),
        enabled: !!company,
        retry: retryUnlessClientError,
    });
    // One key per submission attempt. A retry of the same submission (network
    // drop, double click) reuses it and is de-duplicated by the API; a new
    // entry gets a new key once this one has succeeded.
    const submissionKey = useRef<string>(crypto.randomUUID());

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(journalSchema) as any,
        defaultValues: initialData ? {
            date: initialData.date instanceof Date ? initialData.date.toISOString().split('T')[0] : new Date(initialData.date).toISOString().split('T')[0],
            referenceNumber: initialData.referenceNumber || "",
            tags: initialData.tags || "",
            contactId: initialData.contactId || "",
            currency: initialData.currency || "IDR",
            exchangeRate: 1,
            notes: initialData.notes || initialData.description || "",
            isAdjustingEntry: (initialData as any).isAdjustingEntry || false,
            lines: initialData.lines.map(l => ({
                accountId: l.accountId,
                description: l.description || "",
                debit: l.debit,
                credit: l.credit,
                tax: l.tax ? l.tax.split(',') : []
            }))
        } : {
            date: new Date().toISOString().split('T')[0],
            referenceNumber: "",
            tags: "",
            contactId: "",
            currency: "IDR",
            exchangeRate: 1,
            notes: "",
            isAdjustingEntry: false,
            lines: [
                { accountId: "", description: "", debit: 0, credit: 0, tax: [] },
                { accountId: "", description: "", debit: 0, credit: 0, tax: [] },
            ],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    })

    const lines = useWatch({ control: form.control, name: "lines" });

    // Exact totals in integer minor units; see lib/utils/minor-units.ts.
    const balance = (() => {
        try {
            return balanceOf((lines ?? []).map(l => ({ debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })));
        } catch {
            // An amount with more than 4 decimals cannot balance; the field error says why.
            return null;
        }
    })();
    const totalDebit = balance ? minorToNumber(balance.debit) : 0;
    const totalCredit = balance ? minorToNumber(balance.credit) : 0;
    const difference = balance ? minorToNumber(balance.difference) : 0;
    const isBalanced = balance?.balanced ?? false;

    /**
     * Applies the attachment changes to a saved entry: removals, then
     * uploads. Returns what did not go through so the caller can keep it.
     */
    async function syncAttachments(entryId: string) {
        const failedRemovals: string[] = [];
        let reason: string | undefined;
        for (const attachmentId of removedAttachmentIds) {
            try {
                await apiClient.deleteAttachment(attachmentId, { silent: true });
            } catch (error) {
                failedRemovals.push(attachmentId);
                reason ??= error instanceof Error ? error.message : undefined;
            }
        }
        const results = await Promise.allSettled(pendingFiles.map((file) => {
            const body = new FormData();
            body.append("file", file);
            body.append("entityType", JOURNAL_ATTACHMENT_TYPE);
            body.append("entityId", entryId);
            return apiClient.uploadAttachment(body, { silent: true });
        }));
        const failedUploads = pendingFiles.filter((_, i) => results[i].status === "rejected");
        for (const r of results) {
            if (r.status === "rejected") reason ??= r.reason instanceof Error ? r.reason.message : undefined;
        }
        return { uploaded: pendingFiles.length - failedUploads.length, failedUploads, failedRemovals, reason };
    }

    /**
     * Saves the entry as a Draft, attaches its files, then, if asked, posts
     * it. Posting is a separate API call because it is where segregation of
     * duties applies: with SoD on, the author cannot post their own entry and
     * the draft stays saved. An entry whose files did not all attach is left
     * as a draft, since evidence on a posted entry can no longer be removed.
     */
    async function processSubmit(data: JournalFormValues, post: boolean) {
        setIsSaving(true);
        const payload = {
            ...data,
            lines: data.lines.map(line => ({ ...line, tax: line.tax.join(",") })),
        };

        let id = initialData?.id;
        try {
            if (id) {
                await apiClient.updateJournalEntry(id, payload);
            } else {
                const created = await apiClient.createJournalEntry(payload, submissionKey.current);
                id = created.id;
            }
        } catch {
            // apiClient has shown the server's reason. The form keeps its
            // values and its idempotency key so the user can correct and retry.
            setIsSaving(false);
            return;
        }

        const entryId = id!;
        let attachmentsComplete = true;
        let attachedNote: { description: string } | undefined;
        if (pendingFiles.length > 0 || removedAttachmentIds.length > 0) {
            const outcome = await syncAttachments(entryId);
            // What failed stays on the form, to go up with the next save.
            setPendingFiles(outcome.failedUploads);
            setRemovedAttachmentIds(outcome.failedRemovals);
            attachmentsComplete = outcome.failedUploads.length === 0 && outcome.failedRemovals.length === 0;
            if (outcome.uploaded > 0) {
                attachedNote = { description: `${outcome.uploaded} file${outcome.uploaded === 1 ? "" : "s"} attached` };
            }
            if (!attachmentsComplete) {
                const failed = outcome.failedUploads.length + outcome.failedRemovals.length;
                toast.error(
                    post
                        ? `Saved as draft and not posted: ${failed} attachment change${failed === 1 ? "" : "s"} did not go through`
                        : `Draft saved, but ${failed} attachment change${failed === 1 ? "" : "s"} did not go through`,
                    {
                        description: [...outcome.failedUploads.map(f => f.name), outcome.reason].filter(Boolean).join(" · "),
                        duration: 10_000,
                        // A new entry's form is cleared below; the draft is where to try again.
                        action: initialData?.id ? undefined : {
                            label: "Open draft",
                            onClick: () => router.push(`/dashboard/accounting/journal/edit?id=${entryId}`),
                        },
                    },
                );
            }
        }

        try {
            if (!attachmentsComplete) {
                // Reported above.
            } else if (post) {
                await apiClient.postJournalEntry(entryId, { silent: true });
                toast.success("Journal entry posted to the general ledger", attachedNote);
            } else {
                toast.success("Journal entry saved as draft", attachedNote);
            }
        } catch (error) {
            if (error instanceof ApiError && error.code === "SEGREGATION_OF_DUTIES_VIOLATION") {
                toast.info("Saved as draft", { description: "A second authorised user must review and post this entry." });
            } else {
                toast.error(error instanceof Error ? error.message : "The draft was saved but could not be posted");
            }
        } finally {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: journalKeys.all }),
                queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() }),
            ]);
            setIsSaving(false);
        }

        if (!initialData?.id) {
            form.reset();
            setPendingFiles([]);
            setRemovedAttachmentIds([]);
            submissionKey.current = crypto.randomUUID();
        }
    }

    // Default handler for Form (Enter key) - Defaults to Posted (1)
    async function onSubmit(data: JournalFormValues) {
        if (!canPost) return;
        await processSubmit(data, true);
    }

    // --- ANIMATION VARIANTS ---
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-7xl mx-auto space-y-6 pb-20 relative px-4 sm:px-6">

                {/* --- 1. HEADER SECTION --- */}
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-6"
                >
                    {/* LEFT: Meta Data (Date, Contact, etc) */}
                    <motion.div variants={itemVariants} className="lg:col-span-8">
                        <div className="rounded-xl border border-foreground/10 bg-card/60 p-6">

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Date */}
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Transaction Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant="outline" className={cn("w-full h-11 text-left font-normal transition-colors", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value ? new Date(field.value) : undefined}
                                                        onSelect={(date) => field.onChange(date?.toISOString().split('T')[0])}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )}
                                />

                                {/* Reference */}
                                <FormField
                                    control={form.control}
                                    name="referenceNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Reference No.</FormLabel>
                                            <div className="relative">
                                                <FormControl>
                                                    <Input className="h-11 pl-9 font-mono" placeholder="Auto-generated" {...field} />
                                                </FormControl>
                                                <Hash className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                {/* Contact */}
                                <FormField
                                    control={form.control}
                                    name="contactId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Payee / Entity</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder="Select Contact" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {contacts.map((contact) => (
                                                        <SelectItem key={contact.id} value={contact.id}>{contact.code} · {contact.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                {/* Tags */}
                                <FormField
                                    control={form.control}
                                    name="tags"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Project Tags</FormLabel>
                                            <FormControl>
                                                <Input className="h-11" placeholder="e.g. #Marketing, #Q1" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="mt-4 border-t border-foreground/10 pt-4">
                                <FormField
                                    control={form.control}
                                    name="isAdjustingEntry"
                                    render={({ field }) => (
                                        <div className="flex items-center space-x-2">
                                            <input
                                                id="isAdjustingEntry"
                                                type="checkbox"
                                                checked={field.value}
                                                onChange={(e) => field.onChange(e.target.checked)}
                                                className="h-4 w-4 rounded border-foreground/30 accent-[var(--primary)] cursor-pointer"
                                            />
                                            <label
                                                htmlFor="isAdjustingEntry"
                                                className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
                                            >
                                                Auditor Adjusting Entry (AJE) - Flag this entry for audit adjustments
                                            </label>
                                        </div>
                                    )}
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* RIGHT: Currency Card (Glass Effect) */}
                    <motion.div variants={itemVariants} className="lg:col-span-4">
                        <div className="h-full rounded-xl border border-foreground/10 bg-card/60 p-6 flex flex-col justify-center">
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="currency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Currency</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 font-medium">
                                                        <SelectValue placeholder="Currency" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="IDR">IDR · Rupiah</SelectItem>
                                                    <SelectItem value="USD">USD · US dollar</SelectItem>
                                                    <SelectItem value="SGD">SGD · Singapore dollar</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="exchangeRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Exchange Rate</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <NumericInput
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        className="font-money h-11 pl-9 text-left"
                                                    />
                                                    <TrendingUp className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* --- 2. GRID SECTION --- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="rounded-xl border border-foreground/10 bg-card overflow-hidden"
                >
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40 border-b border-foreground/10 hover:bg-muted/40">
                                <TableHead className="w-[25%] pl-6 py-4 font-mono text-[10px] font-normal text-muted-foreground uppercase tracking-[0.18em]">Account Details</TableHead>
                                <TableHead className="w-[30%] py-4 font-mono text-[10px] font-normal text-muted-foreground uppercase tracking-[0.18em]">Description</TableHead>
                                <TableHead className="w-[20%] py-4 font-mono text-[10px] font-normal text-muted-foreground uppercase tracking-[0.18em] text-right">Debit</TableHead>
                                <TableHead className="w-[20%] py-4 font-mono text-[10px] font-normal text-muted-foreground uppercase tracking-[0.18em] text-right">Credit</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((fieldItem, index) => (
                                <TableRow key={fieldItem.id} className="group transition-colors border-foreground/[0.06] hover:bg-foreground/[0.02]">
                                    {/* Account */}
                                    <TableCell className="pl-6 py-2 align-top">
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.accountId`}
                                            render={({ field }) => (
                                                <FormItem className="space-y-0">
                                                    <AccountCombobox value={field.value} onChange={field.onChange} />
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>

                                    {/* Description */}
                                    <TableCell className="py-2 align-top">
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.description`}
                                            render={({ field }) => (
                                                <Input
                                                    className="h-10 border-transparent bg-transparent group-hover:border-foreground/10 focus:border-foreground/25 transition-colors text-sm"
                                                    placeholder="Description..."
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </TableCell>

                                    {/* Debit */}
                                    <TableCell className="py-2 align-top">
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.debit`}
                                            render={({ field }) => (
                                                <NumericInput
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    disabled={lines[index]?.credit > 0}
                                                    className={cn(
                                                        "font-money h-10 text-sm font-medium",
                                                        lines[index]?.credit > 0 ? "opacity-30 cursor-not-allowed" : "text-emerald-800 dark:text-emerald-300"
                                                    )}
                                                />
                                            )}
                                        />
                                    </TableCell>

                                    {/* Credit */}
                                    <TableCell className="py-2 align-top">
                                        <FormField
                                            control={form.control}
                                            name={`lines.${index}.credit`}
                                            render={({ field }) => (
                                                <NumericInput
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    disabled={lines[index]?.debit > 0}
                                                    className={cn(
                                                        "font-money h-10 text-sm font-medium",
                                                        lines[index]?.debit > 0 ? "opacity-30 cursor-not-allowed" : "text-cyan-800 dark:text-cyan-300"
                                                    )}
                                                />
                                            )}
                                        />
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell className="py-2 align-top text-right pr-4">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            type="button"
                                            className="h-9 w-9 text-muted-foreground/60 hover:text-destructive rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                            onClick={() => remove(index)}
                                            disabled={fields.length <= 2}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Add Line Footer */}
                    <div className="p-2 border-t border-foreground/10">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => append({ accountId: "", description: "", debit: 0, credit: 0, tax: [] })}
                            className="w-full h-10 border border-dashed border-foreground/15 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add line
                        </Button>
                    </div>
                </motion.div>

                {/* --- 3. FOOTER SECTION --- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                >
                    {/* Notes (Left) */}
                    <div className="lg:col-span-8 rounded-xl border border-foreground/10 bg-card/60 p-6">
                        <div className="flex flex-col md:flex-row gap-6 h-full">
                            <div className="flex-1 space-y-2">
                                <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Internal Notes</FormLabel>
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <Textarea
                                            placeholder="Add context to this journal entry..."
                                            className="resize-none h-32"
                                            {...field}
                                        />
                                    )}
                                />
                            </div>
                            <div className="w-px bg-foreground/10 hidden md:block" />
                            <div className="flex-1 space-y-2">
                                <FormLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal">Attachments</FormLabel>
                                <JournalAttachments
                                    entryId={initialData?.id}
                                    pending={pendingFiles}
                                    onPendingChange={setPendingFiles}
                                    removed={removedAttachmentIds}
                                    onRemovedChange={setRemovedAttachmentIds}
                                    canAttach={canAttach}
                                    canRemove={canRemoveAttachments}
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Totals & Save (Right) */}
                    <div className="lg:col-span-4">
                        <div className={cn(
                            "rounded-xl border p-6 transition-colors duration-300",
                            isBalanced
                                ? "border-emerald-600/30 bg-emerald-600/[0.04] dark:border-emerald-400/30 dark:bg-emerald-400/[0.05]"
                                : "border-amber-500/40 bg-amber-500/[0.05]"
                        )}>
                            <div className="space-y-5">
                                {/* Totals Display */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Total debit</span>
                                        <span className="font-money text-emerald-800 dark:text-emerald-300">{formatModuleMoney(totalDebit, "IDR")}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Total credit</span>
                                        <span className="font-money text-cyan-800 dark:text-cyan-300">{formatModuleMoney(totalCredit, "IDR")}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-foreground/10" />

                                {/* Balance Status */}
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-foreground">Difference</span>
                                    {isBalanced ? (
                                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span className="font-money">0,00</span> · Balanced
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <span className="font-money">{formatModuleMoney(difference, "IDR")}</span>
                                        </span>
                                    )}
                                </div>

                                {/* Main Action Buttons */}
                                <div className="flex flex-col gap-3 mt-4">
                                    {canPost && <Button
                                        type="button"
                                        onClick={() => form.handleSubmit((data) => processSubmit(data, true))()}
                                        disabled={!isBalanced || isSaving}
                                        className={cn(
                                            "w-full h-11 text-[15px] font-medium",
                                            !isBalanced && "cursor-not-allowed"
                                        )}
                                    >
                                        {isSaving ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Posting…</>
                                        ) : (
                                            <>{initialData ? "Update and post" : "Post entry"}</>
                                        )}
                                    </Button>}

                                    {canSave && <Button
                                        type="button"
                                        onClick={() => form.handleSubmit((data) => processSubmit(data, false))()}
                                        disabled={isSaving}
                                        variant="outline"
                                        className="w-full h-10"
                                    >
                                        Save as draft
                                    </Button>}

                                    <div className="text-center">
                                        <Button variant="link" type="button" onClick={() => window.history.back()} className="text-xs h-auto p-0 text-muted-foreground hover:text-foreground">
                                            Cancel and go back
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

            </form>
        </Form>
    )
}
