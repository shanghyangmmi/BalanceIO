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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { Loader2 } from "lucide-react"

const revaluationSchema = z.object({
    assetId: z.string().min(1, "Asset is required"),
    revaluationDate: z.string().min(1, "Date is required"),
    newValue: z.number().min(0, "Value must be positive"),
    reason: z.string().optional(),
})

export function AssetRevaluationForm() {
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<any>(null);

    const form = useForm<z.infer<typeof revaluationSchema>>({
        resolver: zodResolver(revaluationSchema),
        defaultValues: {
            revaluationDate: new Date().toISOString().split('T')[0],
            newValue: 0,
            reason: "",
        },
    })

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const allAssets = await apiClient.get<any[]>("/Assets");
                const activeAssets = allAssets.filter((a: any) => a.status === 1);
                setAssets(activeAssets);
            } catch (error) {
                console.error(error);
                toast.error("Failed to load assets");
            }
        };
        fetchAssets();
    }, []);

    const handleAssetSelect = (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            setSelectedAsset(asset);
            form.setValue("newValue", asset.acquisitionCost); // Set current cost as default
        } else {
            setSelectedAsset(null);
            form.setValue("newValue", 0);
        }
    };

    async function onSubmit(values: z.infer<typeof revaluationSchema>) {
        if (!selectedAsset) return;
        setLoading(true);
        try {
            // We need to send the FULL asset object with updated cost
            // The controller expects a PUT with the full object to update fields
            const payload = {
                ...selectedAsset,
                acquisitionCost: values.newValue,
                // Ensure we don't send read-only fields that might cause issues if not handled by backend,
                // but usually controller ignores extra fields or handles them.
                // However, check if controller allows partial updates? No, it maps property by property.
                // So we should send everything we got from GET.
            };

            // Note: The controller implementation I updated checks:
            // if (asset.AcquisitionCost != existing.AcquisitionCost) existing.AcquisitionCost = asset.AcquisitionCost;

            await apiClient.put(`/Assets/${values.assetId}`, payload);
            toast.success("Asset revaluation (cost adjustment) saved");

            // Refresh assets
            const allAssets = await apiClient.get<any[]>("/Assets");
            const activeAssets = allAssets.filter((a: any) => a.status === 1);
            setAssets(activeAssets);
            setSelectedAsset(null);
            form.reset();
        } catch (error) {
            console.error(error);
            toast.error("Failed to revalue asset");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Asset Revaluation</CardTitle>
                <CardDescription>Adjust the acquisition cost / base value of an asset.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="assetId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Asset</FormLabel>
                                    <Select
                                        onValueChange={(val) => {
                                            field.onChange(val);
                                            handleAssetSelect(val);
                                        }}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select asset" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {assets.map(asset => (
                                                <SelectItem key={asset.id} value={asset.id}>
                                                    {asset.name} ({asset.code}) - Current: {asset.acquisitionCost.toLocaleString()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="revaluationDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Revaluation Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="newValue"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Acquisition Cost (IDR)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                {...field}
                                                onChange={e => field.onChange(parseFloat(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            This will update the asset&apos;s base cost and recalculate book value.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason / Notes</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Market value adjustment, Error correction" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Revaluation
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
