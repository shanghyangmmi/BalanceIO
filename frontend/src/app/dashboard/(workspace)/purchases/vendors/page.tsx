"use client";
import { useEffect, useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Contact, contactCategoryLabels, contactScopeLabels, contactTypeLabels } from "@/components/contacts/types";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PlusCircle, Building2, User, Globe, Users, MoreHorizontal, Pencil, Trash, UserPlus, Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { ContactForm } from "@/components/contacts/contact-form";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function VendorsPage() {
    const can = useCan();
    const canManageContacts = can(PERMISSIONS.ContactsManage);
    const [vendors, setVendors] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Contact | null>(null);

    const fetchVendors = async () => {
        try {
            // Fetch only contacts of type Vendor
            const data = await apiClient.getContacts('Vendor');
            setVendors(data);
        } catch (error) {
            console.error("Failed to fetch vendors", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVendors();
    }, []);

    const handleCreate = async (data: any) => {
        try {
            if (editingVendor) {
                await apiClient.put(`/Contacts/${editingVendor.id}`, { ...data, id: editingVendor.id });
                toast.success("Vendor updated successfully");
            } else {
                await apiClient.post("/Contacts", data);
                toast.success("Vendor created successfully");
            }
            setIsSheetOpen(false);
            setEditingVendor(null);
            fetchVendors();
        } catch (error: any) {
            toast.error(error.message || "Failed to save vendor");
        }
    };

    const handleDelete = async (vendor: Contact) => {
        toast.warning("Are you sure you want to delete this vendor?", {
            action: {
                label: "Delete",
                onClick: async () => {
                    try {
                        await apiClient.delete(`/Contacts/${vendor.id}`);
                        toast.success(`Vendor ${vendor.name} deleted`);
                        fetchVendors();
                    } catch (error: any) {
                        toast.error(error.message || "Failed to delete vendor");
                    }
                }
            }
        });
    };

    const columns = useMemo<ColumnDef<Contact>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "name",
            header: "Vendor Name",
            cell: ({ row }) => {
                const category = row.original.category;
                const Icon = category === 0 ? User : Building2;
                return (
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                            <Icon className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.getValue("name")}</div>
                            <div className="text-xs text-muted-foreground">{row.original.code}</div>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => {
                const label = contactCategoryLabels[row.original.category] || "Unknown"
                return (
                    <Badge variant="outline" className="font-normal border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                        {label}
                    </Badge>
                )
            }
        },
        {
            accessorKey: "details",
            header: "Contact Info",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {row.original.email && (
                        <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {row.original.email}
                        </div>
                    )}
                    {(row.original.phone || row.original.mobile) && (
                        <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {row.original.phone || row.original.mobile}
                        </div>
                    )}
                </div>
            )
        },
        {
            accessorKey: "taxId",
            header: "Tax ID",
            cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("taxId") || "-"}</div>
        },
        {
            id: "actions",
            cell: ({ row }) => {
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.code)}>
                                Copy Code
                            </DropdownMenuItem>
                            {canManageContacts && (<>
                          <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                setEditingVendor(row.original);
                                setIsSheetOpen(true);
                            }}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Vendor
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(row.original)}>
                                <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </>)}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        },
    ], [canManageContacts]);

    const totalVendors = vendors.length;
    const corporateVendors = vendors.filter(c => c.category === 1).length;
    const foreignVendors = vendors.filter(c => c.scope === 1).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Vendors</h2>
                </div>
                <div className="flex items-center space-x-2">
                    <Sheet open={isSheetOpen} onOpenChange={(val) => {
                        if (!val) setEditingVendor(null);
                        setIsSheetOpen(val);
                    }}>
                        {can(PERMISSIONS.ContactsManage) && <SheetTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" /> New Vendor
                            </Button>
                        </SheetTrigger>}
                        <SheetContent className="sm:max-w-xl overflow-y-auto">
                            <SheetHeader>
                                <SheetTitle>{editingVendor ? "Edit Vendor" : "Add New Vendor"}</SheetTitle>
                                <SheetDescription>
                                    {editingVendor ? "Update vendor details." : "Add a new vendor to your database."}
                                </SheetDescription>
                            </SheetHeader>
                            <div className="mt-6">
                                <ContactForm
                                    onSubmit={handleCreate}
                                    onCancel={() => setIsSheetOpen(false)}
                                    defaultValues={editingVendor ? {
                                        ...editingVendor,
                                        email: editingVendor.email || "",
                                        phone: editingVendor.phone || "",
                                        mobile: editingVendor.mobile || "",
                                        address: editingVendor.address || "",
                                        city: editingVendor.city || "",
                                        postalCode: editingVendor.postalCode || "",
                                        country: editingVendor.country || "Indonesia",
                                        taxId: editingVendor.taxId || "",
                                    } : {
                                        type: 1 // Default to Vendor
                                    }}
                                />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalVendors}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Corporate Vendors</CardTitle>
                        <Building2 className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{corporateVendors}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Foreign Vendors</CardTitle>
                        <Globe className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-cyan-600">{foreignVendors}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="h-full flex-1 flex-col space-y-8 md:flex">
                <DataTable
                    data={vendors}
                    columns={columns}
                    filterColumn="name"
                    filterPlaceholder="Search vendors..."
                />
            </div>
        </div>
    );
}
