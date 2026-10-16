"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Shield, Pencil, Key, Mail } from "lucide-react";
import { adminApiClient } from "@/lib/api-client"; // Use adminApiClient
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface User {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    twoFactorEnabled: boolean;
    isSuspended: boolean;
    suspendedAt: string | null;
    suspensionReason: string | null;
    companyCount: number;
    companies: { companyId: string; companyName: string; role: string }[];
}

interface UserResponse {
    data: User[];
    pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

    // Edit State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editEmail, setEditEmail] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const fetchUsers = async (page = 1, searchQuery = "") => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams({ page: String(page), pageSize: "20" });
            if (searchQuery) params.append("search", searchQuery);

            // Use adminApiClient
            const data = await adminApiClient.get<UserResponse>(`/admin/users?${params}`);
            setUsers(data.data);
            setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
        } catch (error) {
            console.error("Failed to fetch users:", error);
            // Error is handled by apiClient globally (toast), but we log it.
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSearch = () => {
        fetchUsers(1, search);
    };

    const handleSuspend = async (user: User) => {
        const reason = window.prompt(
            `Suspend ${user.name}? They stop being able to use BalanceIO within thirty seconds. ` +
            `Nothing is deleted.\n\nReason (shown to them and recorded):`,
        );
        if (reason === null) return;

        try {
            await adminApiClient.post(`/admin/users/${user.id}/suspend`, { reason });
            toast.success("User suspended");
            fetchUsers(pagination.page, search);
        } catch (error: any) {
            toast.error("Could not suspend", { description: error?.message });
        }
    };

    const handleRestore = async (id: string) => {
        try {
            await adminApiClient.post(`/admin/users/${id}/restore`, {});
            toast.success("User restored");
            fetchUsers(pagination.page, search);
        } catch (error: any) {
            toast.error("Could not restore", { description: error?.message });
        }
    };

    // The email has to be typed back. This used to be one click on a bare
    // confirm(), for an operation that removes every company membership the
    // user holds.
    const handleDelete = async (user: User) => {
        const typed = window.prompt(
            `This permanently deletes ${user.name}. It is refused if they have authored any ` +
            `journal entry.\n\nType their email address to confirm:`,
        );
        if (typed !== user.email) {
            if (typed !== null) toast.error("That did not match. Nothing was deleted.");
            return;
        }

        try {
            await adminApiClient.delete(
                `/admin/users/${user.id}?confirm=${encodeURIComponent(user.email)}`,
            );
            toast.success("User deleted");
            fetchUsers(pagination.page, search);
        } catch (error: any) {
            toast.error("Could not delete", { description: error?.message });
        }
    };

    const handleMakeAdmin = async (userId: string) => {
        if (!confirm("Promote this user to Superadmin? They will have full system access.")) return;
        try {
            await adminApiClient.post(`/admin/users/${userId}/make-superadmin`, {});
            toast.success("User promoted to Superadmin");
            fetchUsers(pagination.page, search);
        } catch (error) {
            // Handled
        }
    };

    const handleResetMfa = async (userId: string) => {
        if (!confirm("Disable 2FA for this user? Use this only if they lost their device.")) return;
        try {
            await adminApiClient.post(`/admin/users/${userId}/reset-mfa`, {});
            toast.success("MFA disabled for user");
            fetchUsers(pagination.page, search);
        } catch (error) {
            // Handled
        }
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setEditEmail(user.email);
        setEditPassword(""); // Always blank initially
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;
        setIsSaving(true);
        try {
            const payload: any = {};
            if (editEmail !== editingUser.email) payload.email = editEmail;
            if (editPassword) payload.password = editPassword;

            if (Object.keys(payload).length === 0) {
                setEditingUser(null);
                return;
            }

            await adminApiClient.put(`/admin/users/${editingUser.id}`, payload);
            toast.success("User updated successfully");
            setEditingUser(null);
            fetchUsers(pagination.page, search);
        } catch (error) {
            // Handled
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 space-y-6 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
                    <p className="text-muted-foreground">Manage all users in the system</p>
                </div>
            </div>

            <div className="flex gap-2">
                <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="max-w-sm"
                />
                <Button onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                </Button>
            </div>

            {isLoading ? (
                <div className="h-48 flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Loading users...</div>
                </div>
            ) : (
                <div className="space-y-4">
                    {users.map((user, idx) => (
                        <motion.div
                            key={user.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                        >
                            <Card>
                                <CardContent className="flex items-center justify-between py-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="font-medium">{user.name}</div>
                                            {user.isAdmin && <Badge className="bg-red-600 hover:bg-red-700">Admin</Badge>}
                                            {user.twoFactorEnabled && <Badge variant="secondary" className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30">2FA</Badge>}
                                            {user.isSuspended && <Badge variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400">Suspended</Badge>}
                                        </div>
                                        <div className="text-sm text-muted-foreground">{user.email}</div>
                                        {user.suspensionReason && (
                                            <div className="mt-1 text-xs text-red-700 dark:text-red-400">
                                                {user.suspensionReason}
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            {user.companies.map((c) => (
                                                <Badge key={c.companyId} variant="outline" className="text-xs">
                                                    {c.companyName} ({c.role})
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                                            <Pencil className="h-4 w-4 mr-1" /> Edit
                                        </Button>

                                        {!user.isAdmin && (
                                            <Button variant="outline" size="sm" onClick={() => handleMakeAdmin(user.id)}>
                                                <Shield className="h-4 w-4 mr-1" /> Make Admin
                                            </Button>
                                        )}
                                        {user.twoFactorEnabled && (
                                            <Button variant="outline" size="sm" onClick={() => handleResetMfa(user.id)} className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/10">
                                                Reset MFA
                                            </Button>
                                        )}
                                        {/* Suspension is the control that belongs here.
                                            Deleting a user who has authored journal entries
                                            leaves those entries without an author, and the
                                            API refuses it — so the button that used to sit
                                            here would simply have failed. */}
                                        {user.isSuspended ? (
                                            <Button variant="outline" size="sm" onClick={() => handleRestore(user.id)}>
                                                Restore
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={() => handleSuspend(user)}>
                                                Suspend
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Delete permanently"
                                            className="text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                                            onClick={() => handleDelete(user)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        disabled={pagination.page <= 1}
                        onClick={() => fetchUsers(pagination.page - 1, search)}
                    >
                        Previous
                    </Button>
                    <span className="py-2 px-4">Page {pagination.page} of {pagination.totalPages}</span>
                    <Button
                        variant="outline"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => fetchUsers(pagination.page + 1, search)}
                    >
                        Next
                    </Button>
                </div>
            )}

            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update email or reset password for {editingUser?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>New Password <span className="text-xs text-muted-foreground">(Leave blank to keep current)</span></Label>
                            <div className="relative">
                                <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    className="pl-9"
                                    placeholder="Enter new password"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                        <Button onClick={handleSaveUser} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
