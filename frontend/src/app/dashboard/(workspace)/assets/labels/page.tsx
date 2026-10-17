"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Loader2, Pencil, Trash, MapPin } from "lucide-react";
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
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface FixedAssetLocation {
  id: string;
  name: string;
  address?: string;
}

export default function AssetLocationsPage() {
    const can = useCan();
  const [locations, setLocations] = useState<FixedAssetLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<FixedAssetLocation | null>(null);
  const [formData, setFormData] = useState<Partial<FixedAssetLocation>>({
    name: "",
    address: ""
  });
  const [saving, setSaving] = useState(false);

  const fetchLocations = async () => {
    try {
      const data = await apiClient.getAssetLocations();
      setLocations(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingLocation) {
        await apiClient.updateAssetLocation(editingLocation.id, {
          ...editingLocation,
          ...formData
        });
        toast.success("Location updated");
      } else {
        await apiClient.createAssetLocation(formData);
        toast.success("Location created");
      }
      setIsDialogOpen(false);
      setEditingLocation(null);
      resetForm();
      fetchLocations();
    } catch (error) {
      toast.error("Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await apiClient.deleteAssetLocation(id);
      toast.success("Location deleted");
      fetchLocations();
    } catch (error) {
      toast.error("Failed to delete location");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: ""
    });
  };

  const openEdit = (loc: FixedAssetLocation) => {
    setEditingLocation(loc);
    setFormData({
      name: loc.name,
      address: loc.address || ""
    });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingLocation(null);
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Asset Locations</h2>
        {can(PERMISSIONS.AssetsManage) && <Button onClick={openNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Location
        </Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                    No locations found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              {locations.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {loc.name}
                    </div>
                  </TableCell>
                  <TableCell>{loc.address}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {can(PERMISSIONS.AssetsManage) && <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>}
                    {can(PERMISSIONS.AssetsManage) && <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDelete(loc.id)}>
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
            <DialogTitle>{editingLocation ? "Edit Location" : "New Location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Headquarters, Warehouse A"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Optional address"
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
