"use client";
import { useEffect, useState, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Contact, contactCategoryLabels, contactScopeLabels, contactTypeLabels } from "@/components/contacts/types";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PlusCircle, Building2, User, Globe, Users, MoreHorizontal, Pencil, Trash, UserPlus, Phone, Mail, ShoppingCart } from "lucide-react";
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const fetchContacts = async () => {
    try {
      const data = await apiClient.get<Contact[]>("/Contacts");
      setContacts(data);
    } catch (error) {
      console.error("Failed to fetch contacts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleCreate = async (data: any) => {
    try {
      if (editingContact) {
        await apiClient.put(`/Contacts/${editingContact.id}`, { ...data, id: editingContact.id });
        toast.success("Contact updated successfully");
      } else {
        await apiClient.post("/Contacts", data);
        toast.success("Contact created successfully");
      }
      setIsSheetOpen(false);
      setEditingContact(null);
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "Failed to save contact");
    }
  };

  const handleDelete = async (contact: Contact) => {
    toast.warning("Are you sure you want to delete this contact?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await apiClient.delete(`/Contacts/${contact.id}`);
            toast.success(`Contact ${contact.name} deleted`);
            fetchContacts();
          } catch (error: any) {
            toast.error(error.message || "Failed to delete contact");
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
      header: "Name / Entity",
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
      accessorKey: "type",
      header: "Roles",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            {(c.isCustomer || c.type === 0 || c.type === 2) &&
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Customer</Badge>
            }
            {(c.isVendor || c.type === 1 || c.type === 2) &&
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Vendor</Badge>
            }
            {c.isEmployee &&
              <Badge variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Employee</Badge>
            }
            {c.isPkp &&
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">PKP</Badge>
            }
          </div>
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
      accessorKey: "scope",
      header: "Scope",
      cell: ({ row }) => {
        const scope = row.original.scope;
        const label = contactScopeLabels[scope] || "Unknown";
        return (
          <div className="flex items-center gap-2">
            {scope === 1 && <Globe className="h-3 w-3 text-indigo-500" />}
            <span className={scope === 1 ? "text-indigo-600 font-medium" : ""}>
              {label}
            </span>
          </div>
        )
      }
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                setEditingContact(row.original);
                setIsSheetOpen(true);
              }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Contact
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(row.original)}>
                <Trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], []);

  const totalContacts = contacts.length;
  const customers = contacts.filter(c => c.isCustomer || c.type === 0 || c.type === 2).length;
  const vendors = contacts.filter(c => c.isVendor || c.type === 1 || c.type === 2).length;
  const employees = contacts.filter(c => c.isEmployee).length;

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
          <h2 className="text-3xl font-bold tracking-tight text-gradient">Contacts</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Sheet open={isSheetOpen} onOpenChange={(val) => {
            if (!val) setEditingContact(null);
            setIsSheetOpen(val);
          }}>
            <SheetTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" /> New Contact
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</SheetTitle>
                <SheetDescription>
                  {editingContact ? "Update contact details and roles." : "Add a customer, vendor, or employee to your database."}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <ContactForm
                  onSubmit={handleCreate}
                  onCancel={() => setIsSheetOpen(false)}
                  defaultValues={editingContact || undefined}
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
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContacts}</div>
            <p className="text-xs text-muted-foreground">Active Counterparties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <ShoppingCart className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{customers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendors</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{vendors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <User className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{employees}</div>
          </CardContent>
        </Card>
      </div>

      <div className="h-full flex-1 flex-col space-y-8 md:flex">
        <DataTable
          data={contacts}
          columns={columns}
          filterColumn="name"
          filterPlaceholder="Filter contacts..."
        />
      </div>
    </div>
  );
}
