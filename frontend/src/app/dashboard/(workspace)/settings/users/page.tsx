"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MoreHorizontal, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeading } from "@/components/dashboard/page-heading";
import { useCompanyData } from "@/hooks/use-company-data";
import { usePermission } from "@/contexts/permission-context";
import { apiClient } from "@/lib/api-client";

interface CompanyUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  twoFactorEnabled: boolean;
}

/**
 * Roles as a reader sees them. Deliberately colourless: in this product a
 * colour is a balance state (DESIGN-SYSTEM.md §2), and an Auditor is not
 * "out of balance".
 */
const ROLES = {
  Admin: "Full access, including users and settings",
  Finance: "Records and posts transactions; no user management",
  Auditor: "Read-only, for review and compliance",
} as const;

function roleLabel(role: string): string {
  switch (role.toLowerCase()) {
    case "owner":
      return "Owner";
    case "superadmin":
      return "Superadmin";
    case "admin":
    case "manager":
      return "Admin";
    case "finance":
    case "staff":
      return "Finance";
    case "auditor":
    case "viewer":
      return "Auditor";
    default:
      return role;
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function UsersPage() {
  const { company, isLoading: companyLoading } = useCompanyData();
  const { isAdmin, role: currentRole } = usePermission();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<keyof typeof ROLES>("Finance");
  const [isInviting, setIsInviting] = useState(false);

  const fetchUsers = useCallback(async (companyId: string) => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<CompanyUser[]>(`/users/company-users/${companyId}`);
      setUsers(data || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (company && company.id && isAdmin) {
      fetchUsers(company.id);
    } else if (!companyLoading) {
      setIsLoading(false);
    }
  }, [company, companyLoading, isAdmin, fetchUsers]);

  const handleUpdateRole = async (userId: string, targetRole: string) => {
    if (!company?.id) return;
    try {
      await apiClient.put(`/users/update-role`, { userId, companyId: company.id, role: targetRole });
      toast.success(`Role changed to ${targetRole}`);
      fetchUsers(company.id);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "The role could not be changed."));
    }
  };

  const handleRemoveUser = async (userId: string, name: string) => {
    if (!company?.id) return;
    if (!confirm(`Remove ${name}'s access to ${company.name}? Their past entries and approvals stay in the audit trail.`)) return;
    try {
      await apiClient.post(`/users/remove-user`, { userId, companyId: company.id });
      toast.success(`${name} no longer has access`);
      fetchUsers(company.id);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Access could not be removed."));
    }
  };

  const handleInvite = async () => {
    if (!company?.id) return;
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Enter a name and an email address.");
      return;
    }
    try {
      setIsInviting(true);
      await apiClient.post(`/users/invite`, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        companyId: company.id,
        role: inviteRole,
      });
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Finance");
      fetchUsers(company.id);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "The invitation could not be sent."));
    } finally {
      setIsInviting(false);
    }
  };

  const handleMfaToggle = async (userId: string, currentStatus: boolean, name: string) => {
    if (!company?.id) return;
    try {
      await apiClient.put(`/users/update-mfa-status`, { userId, companyId: company.id, enabled: !currentStatus });
      toast.success(`Two-step verification ${currentStatus ? "turned off" : "turned on"} for ${name}`);
      fetchUsers(company.id);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "The two-step setting could not be changed."));
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeading eyebrow="Settings" title="Users" />
        <div className="rounded-xl border border-foreground/10 px-6 py-10">
          <p className="text-sm font-medium text-foreground">User management is limited to administrators.</p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            You are signed in as <span className="font-medium text-foreground">{currentRole}</span>. Under
            segregation of duties, only an Admin can invite people, change roles or remove access. Ask an
            administrator of this company if you need a change.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Settings"
        title="Users"
        lede="Who can open these books, and what each person may do. Roles are enforced by the API, not only hidden in the interface."
        actions={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Invite user</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Invite a user</DialogTitle>
                <DialogDescription>
                  They receive an email to set a password and join {company.name || "this company"}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="invite-name">Full name</Label>
                  <Input id="invite-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="nama@perusahaan.co.id"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as keyof typeof ROLES)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[12px] text-muted-foreground">{ROLES[inviteRole]}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim() || !inviteName.trim()}>
                  {isInviting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="overflow-hidden rounded-xl border border-foreground/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 bg-muted/30 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-5 py-3 font-normal">Name</th>
              <th className="hidden px-5 py-3 font-normal md:table-cell">Role</th>
              <th className="hidden px-5 py-3 font-normal sm:table-cell">Two-step</th>
              <th className="hidden px-5 py-3 font-normal lg:table-cell">Joined</th>
              <th className="w-12 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading || companyLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                  No users yet. Invite your accountant or finance team to start.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.userId} className="border-b border-foreground/[0.06] last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-foreground">{user.name}</div>
                    <div className="text-[12px] text-muted-foreground">{user.email}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground md:hidden">{roleLabel(user.role)}</div>
                  </td>
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    <span className="text-foreground">{roleLabel(user.role)}</span>
                  </td>
                  <td className="hidden px-5 py-3.5 sm:table-cell">
                    {user.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        On
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">Off</span>
                    )}
                  </td>
                  <td className="hidden px-5 py-3.5 font-mono text-[12px] text-muted-foreground lg:table-cell">
                    {user.joinedAt
                      ? new Date(user.joinedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${user.name}`}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Change role</DropdownMenuLabel>
                        {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((r) => (
                          <DropdownMenuItem
                            key={r}
                            disabled={roleLabel(user.role) === r}
                            onClick={() => handleUpdateRole(user.userId, r)}
                          >
                            {r}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleMfaToggle(user.userId, user.twoFactorEnabled, user.name)}>
                          {user.twoFactorEnabled ? "Turn off two-step verification" : "Turn on two-step verification"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleRemoveUser(user.userId, user.name)}
                          className="text-destructive focus:text-destructive"
                        >
                          Remove access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-3">
        {(Object.entries(ROLES) as [string, string][]).map(([role, description]) => (
          <div key={role}>
            <dt className="font-medium text-foreground">{role}</dt>
            <dd className="mt-0.5 leading-relaxed text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
