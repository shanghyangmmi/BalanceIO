"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, ArrowLeft, RefreshCw, CheckCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils/formatter";

interface OpnameLine {
    id: string;
    productId: string;
    product?: { code: string; name: string; unit: string };
    systemQty: number;
    physicalQty: number;
    difference: number;
    notes?: string;
}

interface StockOpname {
    id: string;
    opnameNumber: string;
    opnameDate: string;
    status: number; // 0=Draft, 1=Processed
    description?: string;
    lines: OpnameLine[];
}

interface StockOpnameDetailViewProps {
    id: string;
}

export function StockOpnameDetailView({ id }: StockOpnameDetailViewProps) {
    const router = useRouter();
    const [opname, setOpname] = useState<StockOpname | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        fetchOpname(id);
    }, [id]);

    const fetchOpname = async (opnameId: string) => {
        try {
            const data = await apiClient.getStockOpname(opnameId);
            setOpname(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load opname details");
        } finally {
            setLoading(false);
        }
    };

    const handleInitialize = async () => {
        if (!confirm("This will overwrite current lines with system stock snapshot. Continue?")) return;
        setLoading(true);
        try {
            await apiClient.initializeStockOpname(id);
            toast.success("Opname initialized with current stock");
            fetchOpname(id);
        } catch (error) {
            toast.error("Failed to initialize");
            setLoading(false);
        }
    };

    const handleQtyChange = (lineId: string, val: string) => {
        if (!opname) return;
        const qty = parseFloat(val) || 0;

        const newLines = opname.lines.map(l => {
            if (l.id === lineId) {
                return { ...l, physicalQty: qty, difference: qty - l.systemQty };
            }
            return l;
        });

        setOpname({ ...opname, lines: newLines });
        setDirty(true);
    };

    const handleSave = async () => {
        if (!opname) return;
        setProcessing(true);
        try {
            await apiClient.updateStockOpname(id, opname);
            toast.success("Changes saved");
            setDirty(false);
        } catch (error) {
            toast.error("Failed to save changes");
        } finally {
            setProcessing(false);
        }
    };

    const handleProcess = async () => {
        if (dirty) {
            if (!confirm("You have unsaved changes. Save and process?")) return;
            await handleSave();
        }
        if (!confirm("Are you sure? This will update stock levels for all items.")) return;

        setProcessing(true);
        try {
            await apiClient.processStockOpname(id);
            toast.success("Stock Opname Processed Successfully!");
            fetchOpname(id);
        } catch (error) {
            toast.error("Failed to process opname");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!opname) return <div className="p-8">Opname not found</div>;

    const isDraft = opname.status === 0;

    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/dashboard/inventory/opname">
                        <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-gradient">{opname.opnameNumber}</h2>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <span>{formatDate(opname.opnameDate)}</span>
                            <Badge variant={isDraft ? "outline" : "secondary"}>
                                {isDraft ? "Draft" : "Processed"}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="space-x-2">
                    {isDraft && opname.lines.length === 0 && (
                        <Button variant="outline" onClick={handleInitialize}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Initialize Items
                        </Button>
                    )}
                    {isDraft && (
                        <>
                            <Button variant="outline" onClick={handleSave} disabled={!dirty || processing}>
                                <Save className="mr-2 h-4 w-4" /> Save Draft
                            </Button>
                            <Button onClick={handleProcess} disabled={processing || opname.lines.length === 0}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Process Adjustments
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Count Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">System Qty</TableHead>
                                <TableHead className="text-right w-[150px]">Physical Qty</TableHead>
                                <TableHead className="text-right">Difference</TableHead>
                                <TableHead>Unit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {opname.lines.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No items. Click "Initialize Items" to load all trackable inventory.
                                    </TableCell>
                                </TableRow>
                            )}
                            {opname.lines.map((line) => (
                                <TableRow key={line.id}>
                                    <TableCell>
                                        <div className="font-medium">{line.product?.name}</div>
                                        <div className="text-xs text-muted-foreground">{line.product?.code}</div>
                                    </TableCell>
                                    <TableCell className="text-right">{line.systemQty}</TableCell>
                                    <TableCell className="text-right">
                                        {isDraft ? (
                                            <Input
                                                type="number"
                                                value={line.physicalQty}
                                                onChange={(e) => handleQtyChange(line.id, e.target.value)}
                                                className="text-right h-8"
                                            />
                                        ) : (
                                            <span className="font-bold">{line.physicalQty}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className={`text-right ${line.difference < 0 ? "text-red-500" : line.difference > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                                        {line.difference > 0 ? "+" : ""}{line.difference}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{line.product?.unit}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
