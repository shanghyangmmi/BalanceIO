"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Loader2, Pencil, Trash, Tag } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface FixedAssetCategory {
  id: string;
  name: string;
  description?: string;
  codePrefix: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationMethod: number; // Enum: 0=StraightLine, 1=Declining, etc.
}

const DEPRECIATION_METHODS = [
  { value: 0, label: "Straight Line" },
  { value: 1, label: "Declining Balance" },
  { value: 2, label: "Double Declining Balance" },
  { value: 3, label: "Sum of Years Digits" },
  { value: 4, label: "Units of Production" },
];

export default function AssetCategoriesPage() {
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FixedAssetCategory | null>(null);
  const [formData, setFormData] = useState<Partial<FixedAssetCategory>>({
    name: "",
    description: "",
    codePrefix: "AST",
    defaultUsefulLifeMonths: 60,
    defaultDepreciationMethod: 0
  });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      const data = await apiClient.getAssetCategories();
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
        await apiClient.updateAssetCategory(editingCategory.id, {
          ...editingCategory,
          ...formData
        });
        toast.success("Category updated");
      } else {
        await apiClient.createAssetCategory(formData);
        toast.success("Category created");
      }
      setIsDialogOpen(false);
      setEditingCategory(null);
      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await apiClient.deleteAssetCategory(id);
      toast.success("Category deleted");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      codePrefix: "AST",
      defaultUsefulLifeMonths: 60,
      defaultDepreciationMethod: 0
    });
  };

  const openEdit = (cat: FixedAssetCategory) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || "",
      codePrefix: cat.codePrefix,
      defaultUsefulLifeMonths: cat.defaultUsefulLifeMonths,
      defaultDepreciationMethod: cat.defaultDepreciationMethod
    });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingCategory(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const getMethodLabel = (value: number) => {
    return DEPRECIATION_METHODS.find(m => m.value === value)?.label || "Unknown";
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Asset Categories</h2>
        <Button onClick={openNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Category
        </Button>
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
                <TableHead>Prefix</TableHead>
                <TableHead>Default Method</TableHead>
                <TableHead>Useful Life</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    No categories found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      {cat.name}
                    </div>
                    {cat.description && <div className="text-xs text-muted-foreground ml-6">{cat.description}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{cat.codePrefix}</Badge></TableCell>
                  <TableCell>{getMethodLabel(cat.defaultDepreciationMethod)}</TableCell>
                  <TableCell>{Math.floor(cat.defaultUsefulLifeMonths / 12)} Years ({cat.defaultUsefulLifeMonths} mo)</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDelete(cat.id)}>
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
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Vehicles"
                />
              </div>
              <div className="space-y-2">
                <Label>Prefix</Label>
                <Input
                  value={formData.codePrefix}
                  onChange={e => setFormData({ ...formData, codePrefix: e.target.value.toUpperCase() })}
                  required
                  placeholder="e.g. VEH"
                  maxLength={5}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Method</Label>
                <Select
                  value={formData.defaultDepreciationMethod?.toString()}
                  onValueChange={v => setFormData({ ...formData, defaultDepreciationMethod: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPRECIATION_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Useful Life (Months)</Label>
                <Input
                  type="number"
                  value={formData.defaultUsefulLifeMonths}
                  onChange={e => setFormData({ ...formData, defaultUsefulLifeMonths: parseInt(e.target.value) || 0 })}
                  required
                  min={1}
                />
                <div className="text-xs text-muted-foreground">
                  = {Math.floor((formData.defaultUsefulLifeMonths || 0) / 12)} Years
                </div>
              </div>
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
