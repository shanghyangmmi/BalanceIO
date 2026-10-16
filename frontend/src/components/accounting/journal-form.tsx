"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import * as z from "zod"
import { CalendarIcon, Plus, Trash2, Save, Loader2, Hash, FileText, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { JournalEntry } from "@/lib/types/accounting"
import { defaultContacts as CONTACTS } from "@/lib/data/contacts-data"
import { formatCurrency } from "@/lib/utils/formatter"

// UI COMPONENTS
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { UploadButton } from "@/components/attachments/upload-button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { motion } from "framer-motion"

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
                "font-mono text-right tabular-nums bg-transparent border-transparent focus:bg-blue-50/50 focus:border-blue-200 focus:ring-2 focus:ring-blue-100 transition-all",
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
        debit: z.number().min(0),
        credit: z.number().min(0),
        tax: z.array(z.string()).default([]),
    })).min(2).refine((data) => {
        return data.every(line => (line.debit || 0) > 0 || (line.credit || 0) > 0);
    }, { message: "Value required", path: ["debit"] })
}).refine((data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 1;
}, { message: "Unbalanced", path: ["lines"] });

type JournalFormValues = z.infer<typeof journalSchema>

interface JournalFormProps {
    initialData?: JournalEntry | null;
}

export function JournalForm({ initialData }: JournalFormProps) {
    const [isSaving, setIsSaving] = useState(false);

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

    // Calculate Totals
    const totalDebit = lines?.reduce((sum, line) => sum + (Number(line.debit) || 0), 0) || 0;
    const totalCredit = lines?.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) || 0;
    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference < 1;

    async function processSubmit(data: JournalFormValues, status: number) {
        setIsSaving(true);
        const roundedLines = data.lines.map(line => ({
            ...line,
            debit: Math.round(line.debit * 100) / 100,
            credit: Math.round(line.credit * 100) / 100,
            tax: line.tax.join(",")
        }));

        // Include status in payload
        const payload = { ...data, lines: roundedLines, status };

        try {
            await new Promise(r => setTimeout(r, 800)); // Animation delay
            if (initialData?.id) {
                await apiClient.updateJournalEntry(initialData.id, payload);
            } else {
                await apiClient.createJournalEntry(payload);
                if (status === 0) {
                    // Toast for Draft
                    form.reset();
                } else {
                    // Toast for Posted
                    form.reset();
                }
            }
            // Notify checks logic would go here
        } catch (error) {
            console.error("Failed", error);
        } finally {
            setIsSaving(false);
        }
    }

    // Default handler for Form (Enter key) - Defaults to Posted (1)
    async function onSubmit(data: JournalFormValues) {
        await processSubmit(data, 1);
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
            {/* --- PREMIUM BLUE ATMOSPHERE --- */}
            <div className="fixed inset-0 -z-10 bg-slate-50" />
            <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/80 to-transparent -z-10" />
            <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[100px] -z-10" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-400/5 rounded-full blur-[120px] -z-10" />

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
                        <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] p-6 relative overflow-hidden">
                            {/* Blue Accent Line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500 opacity-80" />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Date */}
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Transaction Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant="outline" className={cn("w-full h-11 text-left font-normal bg-slate-50/50 border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50 text-emerald-600" />
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
                                            <FormLabel className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Reference No.</FormLabel>
                                            <div className="relative">
                                                <FormControl>
                                                    <Input className="h-11 pl-9 bg-slate-50/50 border-slate-200 focus:border-blue-300 focus:ring-blue-100 transition-all" placeholder="Auto-generated" {...field} />
                                                </FormControl>
                                                <Hash className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
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
                                            <FormLabel className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Payee / Entity</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 hover:border-blue-300 focus:ring-blue-100">
                                                        <SelectValue placeholder="Select Contact" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {CONTACTS.map((contact) => (
                                                        <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
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
                                            <FormLabel className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Project Tags</FormLabel>
                                            <FormControl>
                                                <Input className="h-11 bg-slate-50/50 border-slate-200 focus:border-blue-300 focus:ring-blue-100" placeholder="e.g. #Marketing, #Q1" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="mt-4 border-t border-slate-100 pt-4">
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
                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            <label
                                                htmlFor="isAdjustingEntry"
                                                className="text-xs font-semibold text-slate-600 cursor-pointer select-none"
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
                        <div className="h-full rounded-2xl border border-white/60 bg-gradient-to-br from-blue-50/80 to-white/60 backdrop-blur-xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden">
                            {/* Decor */}
                            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl -mr-5 -mt-5" />

                            <div className="space-y-4 relative z-10">
                                <FormField
                                    control={form.control}
                                    name="currency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] uppercase tracking-widest text-emerald-600/70 font-bold">Currency</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 border-blue-100 bg-white/50 text-blue-900 font-medium">
                                                        <SelectValue placeholder="Currency" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="IDR">🇮🇩 IDR (Rupiah)</SelectItem>
                                                    <SelectItem value="USD">🇺🇸 USD (Dollar)</SelectItem>
                                                    <SelectItem value="SGD">🇸🇬 SGD (Dollar)</SelectItem>
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
                                            <FormLabel className="text-[10px] uppercase tracking-widest text-emerald-600/70 font-bold">Exchange Rate</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <NumericInput
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        className="h-11 pl-9 border-blue-100 bg-white/50 text-left"
                                                    />
                                                    <TrendingUp className="absolute left-3 top-3.5 h-4 w-4 text-blue-400" />
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
                    className="rounded-2xl border border-slate-200/60 bg-white shadow-xl shadow-slate-200/40 overflow-hidden"
                >
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/80 border-b border-slate-200 hover:bg-slate-50/80">
                                <TableHead className="w-[25%] pl-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Account Details</TableHead>
                                <TableHead className="w-[30%] py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Description</TableHead>
                                <TableHead className="w-[20%] py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Debit</TableHead>
                                <TableHead className="w-[20%] py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Credit</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((fieldItem, index) => (
                                <TableRow key={fieldItem.id} className="group hover:bg-blue-50/30 transition-colors border-slate-100">
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
                                                    className="h-10 border-transparent bg-transparent group-hover:bg-white group-hover:border-slate-200 focus:border-blue-300 focus:bg-white transition-all text-sm"
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
                                                        "h-10 text-sm font-medium",
                                                        lines[index]?.credit > 0 ? "opacity-30 cursor-not-allowed" : "text-slate-700"
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
                                                        "h-10 text-sm font-medium",
                                                        lines[index]?.debit > 0 ? "opacity-30 cursor-not-allowed" : "text-slate-700"
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
                                            className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
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
                    <div className="p-2 border-t border-slate-200 bg-slate-50/50">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => append({ accountId: "", description: "", debit: 0, credit: 0, tax: [] })}
                            className="w-full h-10 border border-dashed border-slate-300 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Transaction Line
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
                    <div className="lg:col-span-8 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-6 h-full">
                            <div className="flex-1 space-y-2">
                                <FormLabel className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Internal Notes</FormLabel>
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <Textarea
                                            placeholder="Add context to this journal entry..."
                                            className="resize-none bg-slate-50/50 border-slate-200 h-32 focus:ring-blue-100"
                                            {...field}
                                        />
                                    )}
                                />
                            </div>
                            <div className="w-px bg-slate-200 hidden md:block" />
                            <div className="flex-1 space-y-2">
                                <FormLabel className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Attachments</FormLabel>
                                <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/30 hover:bg-blue-50/30 hover:border-blue-200 transition-colors">
                                    <UploadButton onUpload={(f) => { }} className="h-full w-full" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Totals & Save (Right) */}
                    <div className="lg:col-span-4">
                        <div className={cn(
                            "rounded-2xl p-6 shadow-2xl transition-all duration-500 relative overflow-hidden",
                            isBalanced
                                ? "bg-gradient-to-br from-slate-900 to-blue-950 text-white shadow-blue-900/20"
                                : "bg-white border border-red-100 shadow-red-100"
                        )}>
                            {/* Texture for Balanced State */}
                            {isBalanced && <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -mt-10 -mr-10 pointer-events-none" />}

                            <div className="space-y-5 relative z-10">
                                {/* Totals Display */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm opacity-80">
                                        <span>Total Debit</span>
                                        <span className="font-mono tracking-tight">{formatCurrency(totalDebit)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm opacity-80">
                                        <span>Total Credit</span>
                                        <span className="font-mono tracking-tight">{formatCurrency(totalCredit)}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-current opacity-20" />

                                {/* Balance Status */}
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium opacity-90">Balance Status</span>
                                    {isBalanced ? (
                                        <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-0">
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Balanced
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-0 shadow-none">
                                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Difference: {formatCurrency(difference)}
                                        </Badge>
                                    )}
                                </div>

                                {/* Main Action Buttons */}
                                <div className="flex flex-col gap-3 mt-4">
                                    <Button
                                        type="button"
                                        onClick={() => form.handleSubmit((data) => processSubmit(data, 1))()} // 1 = Posted
                                        disabled={!isBalanced || isSaving}
                                        className={cn(
                                            "w-full h-12 text-base font-semibold shadow-lg transition-all",
                                            isBalanced
                                                ? "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white border-0 shadow-teal-900/40 hover:scale-[1.02]"
                                                : "bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-not-allowed"
                                        )}
                                    >
                                        {isSaving ? (
                                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                                        ) : (
                                            <><Save className="w-5 h-5 mr-2" /> {initialData ? "Update & Post" : "Post Entry"}</>
                                        )}
                                    </Button>

                                    <Button
                                        type="button"
                                        onClick={() => form.handleSubmit((data) => processSubmit(data, 0))()} // 0 = Draft
                                        disabled={isSaving}
                                        variant="outline"
                                        className="w-full h-10 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                                    >
                                        <FileText className="w-4 h-4 mr-2" /> Save as Draft
                                    </Button>

                                    <div className="text-center">
                                        <Button variant="link" type="button" onClick={() => window.history.back()} className={cn("text-xs h-auto p-0 opacity-60 hover:opacity-100", isBalanced ? "text-blue-200" : "text-slate-500")}>
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
