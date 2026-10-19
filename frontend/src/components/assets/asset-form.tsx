"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/formatter"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

const assetSchema = z.object({
    name: z.string().min(1, "Name is required"),
    categoryId: z.string().min(1, "Category is required"),
    locationId: z.string().optional(),
    purchaseDate: z.string().min(1, "Purchase date is required"),
    cost: z.number().min(0, "Cost must be positive"),
    salvageValue: z.number().min(0, "Salvage value must be positive"),
    usefulLifeMonths: z.number().min(1, "Useful life must be at least 1 month"),
    serialNumber: z.string().optional(),
    fiscalGroup: z.number(),
    fiscalMethod: z.number(),
    buildingLifeYears: z.number().optional(),
    assetAccountId: z.string().optional(),
    accumulatedDepreciationAccountId: z.string().optional(),
    depreciationAccountId: z.string().optional(),
})

/** Mirrors Models/FixedAsset.cs FiscalGroup and FiscalMethod. */
export const FISCAL_GROUPS = [
    { value: 0, label: "Belum diklasifikasikan", years: null },
    { value: 1, label: "Kelompok 1", years: 4 },
    { value: 2, label: "Kelompok 2", years: 8 },
    { value: 3, label: "Kelompok 3", years: 16 },
    { value: 4, label: "Kelompok 4", years: 20 },
    { value: 5, label: "Bangunan permanen", years: 20 },
    { value: 6, label: "Bangunan tidak permanen", years: 10 },
    { value: 7, label: "Tidak disusutkan (tanah)", years: null },
] as const

export const isBuilding = (group: number) => group === 5 || group === 6

type AssetFormValues = z.infer<typeof assetSchema>

interface AssetFormProps {
    initialData?: any;
    isEditing?: boolean;
}

export function AssetForm({ initialData, isEditing }: AssetFormProps) {
    const router = useRouter();
    const [categories, setCategories] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<{ id: string; code: string; name: string; type: string; isHeader?: boolean }[]>([]);
    const [loading, setLoading] = useState(false);

    const form = useForm<AssetFormValues>({
        resolver: zodResolver(assetSchema),
        defaultValues: {
            name: initialData?.name || "",
            categoryId: initialData?.categoryId || "",
            locationId: initialData?.locationId || "",
            purchaseDate: initialData?.acquisitionDate ? initialData.acquisitionDate.split('T')[0] : new Date().toISOString().split('T')[0],
            cost: initialData?.acquisitionCost || 0,
            salvageValue: initialData?.residualValue || 0,
            usefulLifeMonths: initialData?.usefulLifeMonths || 60,
            serialNumber: initialData?.serialNumber || "",
            fiscalGroup: initialData?.fiscalGroup ?? 0,
            fiscalMethod: initialData?.fiscalMethod ?? 0,
            buildingLifeYears: initialData?.fiscalUsefulLifeMonths ? initialData.fiscalUsefulLifeMonths / 12 : undefined,
            assetAccountId: initialData?.assetAccountId || "",
            accumulatedDepreciationAccountId: initialData?.accumulatedDepreciationAccountId || "",
            depreciationAccountId: initialData?.depreciationAccountId || "",
        },
    })

    const formValues = useWatch({ control: form.control });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [cats, locs, accs] = await Promise.all([
                    apiClient.getAssetCategories(),
                    apiClient.getAssetLocations(),
                    apiClient.getAccounts(),
                ]);
                setCategories(cats);
                setLocations(locs);
                setAccounts((accs as unknown as typeof accounts).filter((a) => !a.isHeader));
            } catch (error) {
                console.error(error);
                toast.error("Failed to load form data");
            }
        };
        fetchData();
    }, []);

    // Auto-fill useful life when category changes (if creating new)
    useEffect(() => {
        if (!isEditing && formValues.categoryId) {
            const cat = categories.find(c => c.id === formValues.categoryId);
            if (cat) {
                form.setValue("usefulLifeMonths", cat.defaultUsefulLifeMonths);
                form.setValue("fiscalGroup", cat.defaultFiscalGroup ?? 0);
                form.setValue("fiscalMethod", cat.defaultFiscalMethod ?? 0);
            }
        }
    }, [formValues.categoryId, categories, isEditing, form]);

    // Calculate Depreciation Schedule Preview (Straight Line)
    const calculateSchedule = () => {
        const cost = formValues.cost || 0;
        const salvage = formValues.salvageValue || 0;
        const months = formValues.usefulLifeMonths || 1;
        const depreciableAmount = Math.max(0, cost - salvage);
        const monthlyDepreciation = depreciableAmount / months;

        const schedule = [];
        let currentBookValue = cost;
        let accumulatedDepreciation = 0;

        // Generate first 12 months for detail
        for (let i = 1; i <= 12; i++) {
            accumulatedDepreciation += monthlyDepreciation;
            currentBookValue -= monthlyDepreciation;
            if (currentBookValue < salvage) currentBookValue = salvage;

            schedule.push({
                period: i,
                depreciation: monthlyDepreciation,
                accumulated: accumulatedDepreciation,
                bookValue: currentBookValue
            });
        }
        return { monthlyDepreciation, schedule };
    }

    const { monthlyDepreciation, schedule } = calculateSchedule();

    async function onSubmit(data: AssetFormValues) {
        setLoading(true);
        try {
            const { buildingLifeYears, ...rest } = data;
            const payload = {
                ...rest,
                fiscalUsefulLifeMonths: data.fiscalGroup === 5 && buildingLifeYears ? Math.round(buildingLifeYears * 12) : null,
                fiscalMethod: isBuilding(data.fiscalGroup) ? 0 : data.fiscalMethod,
                assetAccountId: data.assetAccountId || null,
                accumulatedDepreciationAccountId: data.accumulatedDepreciationAccountId || null,
                depreciationAccountId: data.depreciationAccountId || null,
                description: "", // Add field if needed
                acquisitionDate: data.purchaseDate,
                acquisitionCost: data.cost,
                residualValue: data.salvageValue,
                // If editing, preserve ID
                id: initialData?.id
            };

            if (isEditing && initialData?.id) {
                await apiClient.put(`/Assets/${initialData.id}`, payload);
                toast.success("Asset updated successfully");
            } else {
                await apiClient.post("/Assets", payload);
                toast.success("Asset created successfully");
            }
            router.push("/dashboard/assets");
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save asset");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Asset Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Asset Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. MacBook Pro M3" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="categoryId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Category</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Category" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {categories.map((c) => (
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
                                        name="locationId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Location</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Location" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {locations.map((l) => (
                                                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="purchaseDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Purchase Date</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="serialNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Serial Number</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Optional" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Valuation & Life</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="cost"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Acquisition Cost</FormLabel>
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
                                <FormField
                                    control={form.control}
                                    name="salvageValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Salvage Value (Residual)</FormLabel>
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
                                <FormField
                                    control={form.control}
                                    name="usefulLifeMonths"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Useful Life (Months)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    {...field}
                                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                {Math.floor(field.value / 12)} Years {field.value % 12} Months
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tax and accounts</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Kelompok harta for tax depreciation (UU PPh Pasal 11). Commercial depreciation above is unaffected.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="fiscalGroup"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Fiscal group</FormLabel>
                                                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {FISCAL_GROUPS.map((g) => (
                                                            <SelectItem key={g.value} value={String(g.value)}>
                                                                {g.label}{g.years ? ` · ${g.years} years` : ""}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {formValues.fiscalGroup !== undefined && formValues.fiscalGroup >= 1 && formValues.fiscalGroup <= 4 && (
                                        <FormField
                                            control={form.control}
                                            name="fiscalMethod"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Fiscal method</FormLabel>
                                                    <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="0">Garis lurus (straight line)</SelectItem>
                                                            <SelectItem value="1">Saldo menurun (declining balance)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    {formValues.fiscalGroup === 5 && (
                                        <FormField
                                            control={form.control}
                                            name="buildingLifeYears"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Actual useful life (years)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder="20"
                                                            value={field.value ?? ""}
                                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>Only when longer than 20 years (PMK 72/2023).</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                                {([
                                    ["assetAccountId", "Asset account", "Asset"],
                                    ["accumulatedDepreciationAccountId", "Accumulated depreciation account", "Asset"],
                                    ["depreciationAccountId", "Depreciation expense account", "Expense"],
                                ] as const).map(([name, label, type]) => (
                                    <FormField
                                        key={name}
                                        control={form.control}
                                        name={name}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{label}</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {accounts.filter((a) => a.type === type).map((a) => (
                                                            <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                                <p className="text-xs text-muted-foreground">
                                    Depreciation and disposal post to these accounts and are refused without them.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Depreciation Schedule Preview</CardTitle>
                                <p className="text-sm text-muted-foreground">Straight Line Method</p>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6 p-4 bg-zinc-50 dark:bg-white/5 rounded-lg border">
                                    <p className="text-sm font-medium text-zinc-500">Monthly Expense</p>
                                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(monthlyDepreciation)}</p>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Month</TableHead>
                                            <TableHead className="text-right">Expense</TableHead>
                                            <TableHead className="text-right">Book Value</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {schedule.map((row) => (
                                            <TableRow key={row.period}>
                                                <TableCell>Month {row.period}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.depreciation)}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(row.bookValue)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <p className="mt-4 text-xs text-center text-muted-foreground">Showing first 12 months only</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" type="button" onClick={() => router.back()}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Update Asset" : "Onboard Asset"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
