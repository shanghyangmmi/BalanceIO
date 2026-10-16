"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Loader2, Pencil, Trash } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProductUnit {
    id: string;
    initials: string;
    name: string;
    description?: string;
    isActive: boolean;
}

export default function InventoryUnitsPage() {
    const [units, setUnits] = useState<ProductUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<ProductUnit | null>(null);
    const [formData, setFormData] = useState({ initials: "", name: "", description: "" });
    const [saving, setSaving] = useState(false);

    const fetchUnits = async () => {
        try {
            const data = await apiClient.getProductUnits();
            setUnits(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load units");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnits();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingUnit) {
                await apiClient.updateProductUnit(editingUnit.id, {
                    ...editingUnit,
                    ...formData
                });
                toast.success("Unit updated");
            } else {
                await apiClient.createProductUnit(formData);
                toast.success("Unit created");
            }
            setIsDialogOpen(false);
            setEditingUnit(null);
            setFormData({ initials: "", name: "", description: "" });
            fetchUnits();
        } catch (error) {
            toast.error("Failed to save unit");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will soft-delete the unit.")) return;
        try {
            await apiClient.deleteProductUnit(id);
            toast.success("Unit deleted");
            fetchUnits();
        } catch (error) {
            toast.error("Failed to delete unit");
        }
    };

    const openEdit = (unit: ProductUnit) => {
        setEditingUnit(unit);
        setFormData({ initials: unit.initials, name: unit.name, description: unit.description || "" });
        setIsDialogOpen(true);
    };

    const openNew = () => {
        setEditingUnit(null);
        setFormData({ initials: "", name: "", description: "" });
        setIsDialogOpen(true);
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-gradient">Product Units</h2>
                <Button onClick={openNew}>
                    <PlusCircle className="mr-2 h-4 w-4" /> New Unit
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Units of Measurement</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Initials</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {units.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No units found. Create one (e.g. pcs, kg, box).
                                    </TableCell>
                                </TableRow>
                            )}
                            {units.map((unit) => (
                                <TableRow key={unit.id}>
                                    <TableCell className="font-mono font-medium">{unit.initials}</TableCell>
                                    <TableCell>{unit.name}</TableCell>
                                    <TableCell>{unit.description}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(unit)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDelete(unit.id)}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUnit ? "Edit Unit" : "New Unit"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Initials</Label>
                                <Input
                                    value={formData.initials}
                                    onChange={e => setFormData({ ...formData, initials: e.target.value })}
                                    required
                                    placeholder="e.g. pcs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="e.g. Pieces"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Optional description"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
