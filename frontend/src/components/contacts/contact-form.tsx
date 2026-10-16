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
import { Checkbox } from "@/components/ui/checkbox"
import { Contact, ptkpStatusOptions, withholdingTypeOptions } from "@/components/contacts/types"
import { ShoppingCart, Truck, UserCheck, Receipt, Building2 } from "lucide-react"

const contactFormSchema = z.object({
    name: z.string().min(2, { message: "Name is required (min 2 chars)." }),
    code: z.string().optional(),
    category: z.coerce.number().min(0).max(2),
    scope: z.coerce.number().min(0).max(1),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    mobile: z.string().optional(),
    taxId: z.string().optional(),
    taxName: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    creditLimit: z.coerce.number().optional(),
    paymentTermDays: z.coerce.number().optional(),
    isActive: z.boolean().default(true),

    // Additive Contact Roles
    isCustomer: z.boolean().default(true),
    isVendor: z.boolean().default(false),
    isEmployee: z.boolean().default(false),
    isTaxParty: z.boolean().default(false),

    // Employee Attributes
    nik: z.string().optional(),
    ptkpStatus: z.string().optional(),
    bpjsKetenagakerjaanNumber: z.string().optional(),
    bpjsKesehatanNumber: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankAccountHolder: z.string().optional(),

    // Vendor Withholding Profile
    withholdingType: z.string().optional(),
    withholdingRate: z.coerce.number().optional(),
    hasWithholdingExemption: z.boolean().default(false),
    exemptionExpiryDate: z.string().optional(),

    // Tax Party
    isPkp: z.boolean().default(false),
    pkpDate: z.string().optional(),
})

type ContactFormValues = z.infer<typeof contactFormSchema>

interface ContactFormProps {
    defaultValues?: Partial<Contact>
    onSubmit: (data: any) => void
    onCancel?: () => void
}

export function ContactForm({ defaultValues, onSubmit, onCancel }: ContactFormProps) {
    const initialValues: ContactFormValues = {
        name: defaultValues?.name || "",
        code: defaultValues?.code || "",
        category: defaultValues?.category ?? 1,
        scope: defaultValues?.scope ?? 0,
        email: defaultValues?.email || "",
        phone: defaultValues?.phone || "",
        mobile: defaultValues?.mobile || "",
        taxId: defaultValues?.taxId || "",
        taxName: defaultValues?.taxName || "",
        address: defaultValues?.address || "",
        city: defaultValues?.city || "",
        country: defaultValues?.country || "Indonesia",
        postalCode: defaultValues?.postalCode || "",
        creditLimit: defaultValues?.creditLimit ?? 0,
        paymentTermDays: defaultValues?.paymentTermDays ?? 30,
        isActive: defaultValues?.isActive ?? true,

        isCustomer: defaultValues?.isCustomer ?? (defaultValues?.type === 0 || defaultValues?.type === 2 || !defaultValues),
        isVendor: defaultValues?.isVendor ?? (defaultValues?.type === 1 || defaultValues?.type === 2),
        isEmployee: defaultValues?.isEmployee ?? false,
        isTaxParty: defaultValues?.isTaxParty ?? (!!defaultValues?.taxId),

        nik: defaultValues?.nik || "",
        ptkpStatus: defaultValues?.ptkpStatus || "TK/0",
        bpjsKetenagakerjaanNumber: defaultValues?.bpjsKetenagakerjaanNumber || "",
        bpjsKesehatanNumber: defaultValues?.bpjsKesehatanNumber || "",
        bankName: defaultValues?.bankName || "",
        bankAccountNumber: defaultValues?.bankAccountNumber || "",
        bankAccountHolder: defaultValues?.bankAccountHolder || "",

        withholdingType: defaultValues?.withholdingType || "None",
        withholdingRate: defaultValues?.withholdingRate ?? 0,
        hasWithholdingExemption: defaultValues?.hasWithholdingExemption ?? false,
        exemptionExpiryDate: defaultValues?.exemptionExpiryDate || "",

        isPkp: defaultValues?.isPkp ?? false,
        pkpDate: defaultValues?.pkpDate || "",
    }

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactFormSchema) as any,
        defaultValues: initialValues,
    })

    const isCustomer = form.watch("isCustomer");
    const isVendor = form.watch("isVendor");
    const isEmployee = form.watch("isEmployee");
    const isTaxParty = form.watch("isTaxParty");

    function handleSubmit(data: ContactFormValues) {
        onSubmit(data)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>Name / Legal Entity Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. PT Maju Terus / Budi Santoso" {...field} />
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
                                <FormLabel>Contact Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="Auto-generated if empty" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select
                                    onValueChange={(val) => field.onChange(parseInt(val))}
                                    defaultValue={field.value.toString()}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="0">Individual (Orang Pribadi)</SelectItem>
                                        <SelectItem value="1">Corporate (Badan)</SelectItem>
                                        <SelectItem value="2">Government (Instansi Pemerintah)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Roles Selector Section */}
                    <div className="col-span-2 p-3 bg-zinc-50 dark:bg-zinc-900 border rounded-lg space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Active Roles (Can hold multiple)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <FormField
                                control={form.control}
                                name="isCustomer"
                                render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0 rounded-md border p-2 bg-background">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                                            <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" /> Customer
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="isVendor"
                                render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0 rounded-md border p-2 bg-background">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                                            <Truck className="h-3.5 w-3.5 text-blue-600" /> Vendor
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="isEmployee"
                                render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0 rounded-md border p-2 bg-background">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                                            <UserCheck className="h-3.5 w-3.5 text-purple-600" /> Employee
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="isTaxParty"
                                render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0 rounded-md border p-2 bg-background">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                                            <Receipt className="h-3.5 w-3.5 text-amber-600" /> Tax Party
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* Employee Profile Section */}
                    {isEmployee && (
                        <div className="col-span-2 p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                Employee & Payroll Profile (Unblocks PPh 21)
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="nik"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">NIK (16 Digits)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="3201..." maxLength={16} {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ptkpStatus"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">PTKP Status</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {ptkpStatusOptions.map((opt) => (
                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bpjsKetenagakerjaanNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">BPJS Ketenagakerjaan #</FormLabel>
                                            <FormControl>
                                                <Input placeholder="KPJ..." {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bpjsKesehatanNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">BPJS Kesehatan #</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Card #..." {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bankName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Payroll Bank</FormLabel>
                                            <FormControl>
                                                <Input placeholder="BCA / Mandiri / BRI" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bankAccountNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Account Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. 1234567890" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {/* Vendor Withholding Section */}
                    {isVendor && (
                        <div className="col-span-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                Vendor Withholding Profile (Unblocks PPh 23 / 4(2))
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="withholdingType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Default Withholding Object</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {withholdingTypeOptions.map((opt) => (
                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="hasWithholdingExemption"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2 space-y-0 pt-6">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <FormLabel className="text-xs cursor-pointer">Has SKB (Exemption Certificate)</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tax & NPWP Section */}
                    <FormField
                        control={form.control}
                        name="taxId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tax ID (NPWP)</FormLabel>
                                <FormControl>
                                    <Input placeholder="00.000.000.0-000.000" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="isPkp"
                        render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0 pt-8">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm cursor-pointer">PKP (Pengusaha Kena Pajak)</FormLabel>
                            </FormItem>
                        )}
                    />

                    {/* Contact details */}
                    <div className="col-span-2">
                        <h3 className="mb-2 font-medium text-sm text-muted-foreground">Contact & Address</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="email@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+62..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>Address</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Full address" className="resize-none" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                    <Input placeholder="Jakarta" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Country</FormLabel>
                                <FormControl>
                                    <Input placeholder="Indonesia" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end space-x-2 pt-6 border-t">
                    {onCancel && (
                        <Button variant="outline" type="button" onClick={onCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button type="submit">Save Contact</Button>
                </div>
            </form>
        </Form>
    )
}
