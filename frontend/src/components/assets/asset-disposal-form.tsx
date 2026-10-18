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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { Loader2 } from "lucide-react"
import { formatModuleMoney } from "@/lib/utils/module-money"

const disposalSchema = z.object({
    assetId: z.string().min(1, "Asset is required"),
    date: z.string().min(1, "Date is required"),
    type: z.enum(["SALE", "SCRAP", "LOST", "DONATION"]),
    salePrice: z.number().optional(),
    proceedsAccountId: z.string().optional(),
    reason: z.string().optional(),
}).refine((v) => v.type !== "SALE" || !v.salePrice || !!v.proceedsAccountId, {
    message: "Choose the account that received the proceeds",
    path: ["proceedsAccountId"],
})

// Active (0) and fully depreciated (1) assets can be disposed of; the form
// used to list only status 1, so an asset still being depreciated never appeared.
const disposable = (a: any) => a.status === 0 || a.status === 1

export function AssetDisposalForm() {
    const [assets, setAssets] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<{ id: string; code: string; name: string; type: string; isHeader?: boolean }[]>([]);
    const [loading, setLoading] = useState(false);

    const form = useForm<z.infer<typeof disposalSchema>>({
        resolver: zodResolver(disposalSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            type: "SALE",
            reason: "",
            salePrice: 0
        },
    })

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const [allAssets, allAccounts] = await Promise.all([apiClient.get<any[]>("/Assets"), apiClient.getAccounts()]);
                setAssets(allAssets.filter(disposable));
                setAccounts((allAccounts as unknown as typeof accounts).filter((a) => a.type === "Asset" && !a.isHeader));
            } catch (error) {
                console.error(error);
                toast.error("Failed to load assets");
            }
        };
        fetchAssets();
    }, []);

    async function onSubmit(values: z.infer<typeof disposalSchema>) {
        setLoading(true);
        try {
            const isSale = values.type === "SALE";
            const payload = {
                date: values.date,
                amount: isSale ? values.salePrice : 0,
                reason: values.reason || values.type,
                isSale: isSale,
                proceedsAccountId: isSale && values.salePrice ? values.proceedsAccountId : null,
            };

            const result = await apiClient.post<{ gainOrLoss: number }>(`/Assets/${values.assetId}/dispose`, payload);
            const amount = formatModuleMoney(Math.abs(result.gainOrLoss), "IDR");
            toast.success(result.gainOrLoss === 0 ? "Disposal posted at book value" : `Disposal posted: ${result.gainOrLoss > 0 ? "gain" : "loss"} of ${amount}`);
            form.reset();
            const allAssets = await apiClient.get<any[]>("/Assets");
            setAssets(allAssets.filter(disposable));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to dispose asset");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Record Asset Disposal</CardTitle>
                <CardDescription>
                    Posts the disposal: accumulated depreciation and cost come off the books, proceeds go to the account chosen,
                    and the difference to Gain (7-3000) or Loss (8-4000) on Asset Disposal. Charge depreciation up to the disposal date first.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="assetId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Asset</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select asset to dispose" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {assets.map(asset => (
                                                    <SelectItem key={asset.id} value={asset.id}>
                                                        {asset.name} ({asset.code})
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
                                        <FormLabel>Disposal Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Disposal Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="SALE">Sale (Sold to 3rd party)</SelectItem>
                                                <SelectItem value="SCRAP">Scrap / Write-off</SelectItem>
                                                <SelectItem value="LOST">Lost / Stolen</SelectItem>
                                                <SelectItem value="DONATION">Donation</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {form.watch("type") === "SALE" && (
                                <FormField
                                    control={form.control}
                                    name="salePrice"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sale Price (IDR)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="Example: 5000000"
                                                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                                    value={field.value ?? ''}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {form.watch("type") === "SALE" && (
                                <FormField
                                    control={form.control}
                                    name="proceedsAccountId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Proceeds received in</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Cash, bank or receivable" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {accounts.map((a) => (
                                                        <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason / Notes</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Details regarding the disposal..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full md:w-auto" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Disposal
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
