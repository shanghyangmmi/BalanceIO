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
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface ProductCategory {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
}

export default function InventoryCategoriesPage() {
    const can = useCan();
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "" });
    const [saving, setSaving] = useState(false);

    const fetchCategories = async () => {
        try {
            const data = await apiClient.getProductCategories();
            setCategories(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingCategory) {
                await apiClient.updateProductCategory(editingCategory.id, {
                    ...editingCategory,
                    ...formData
                });
                toast.success("Category updated");
            } else {
                await apiClient.createProductCategory(formData);
                toast.success("Category created");
            }
            setIsDialogOpen(false);
            setEditingCategory(null);
            setFormData({ name: "", description: "" });
            fetchCategories();
        } catch (error) {
            toast.error("Failed to save category");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will soft-delete the category.")) return;
        try {
            await apiClient.deleteProductCategory(id);
            toast.success("Category deleted");
            fetchCategories();
        } catch (error) {
            toast.error("Failed to delete category");
        }
    };

    const openEdit = (cat: ProductCategory) => {
        setEditingCategory(cat);
        setFormData({ name: cat.name, description: cat.description || "" });
        setIsDialogOpen(true);
    };

    const openNew = () => {
        setEditingCategory(null);
        setFormData({ name: "", description: "" });
        setIsDialogOpen(true);
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Product Categories</h2>
                {can(PERMISSIONS.InventoryManage) && <Button onClick={openNew}>
                    <PlusCircle className="mr-2 h-4 w-4" /> New Category
                </Button>}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Categories</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                        No categories found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                            {categories.map((cat) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-medium">{cat.name}</TableCell>
                                    <TableCell>{cat.description}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {can(PERMISSIONS.InventoryManage) && <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>}
                                        {can(PERMISSIONS.InventoryManage) && <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDelete(cat.id)}>
                                            <Trash className="h-4 w-4" />
                                        </Button>}
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
                        <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="e.g. Electronics, Services"
                            />
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
