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

const disposalSchema = z.object({
    assetId: z.string().min(1, "Asset is required"),
    date: z.string().min(1, "Date is required"),
    type: z.enum(["SALE", "SCRAP", "LOST", "DONATION"]),
    salePrice: z.number().optional(),
    reason: z.string().optional(),
})

export function AssetDisposalForm() {
    const [assets, setAssets] = useState<any[]>([]);
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
                // Fetch only active assets (status=1)
                const allAssets = await apiClient.get<any[]>("/Assets");
                // Filter for active assets locally if API doesn't filter
                const activeAssets = allAssets.filter((a: any) => a.status === 1);
                setAssets(activeAssets);
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
                isSale: isSale
            };

            await apiClient.post(`/Assets/${values.assetId}/dispose`, payload);
            toast.success("Asset disposal recorded successfully");
            form.reset();
            // Refresh assets list
            const allAssets = await apiClient.get<any[]>("/Assets");
            setAssets(allAssets.filter((a: any) => a.status === 1));
        } catch (error) {
            console.error(error);
            toast.error("Failed to dispose asset");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Record Asset Disposal</CardTitle>
                <CardDescription>Sell, write-off, or donate a fixed asset.</CardDescription>
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
