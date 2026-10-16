"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  MoreHorizontal, Plus, ShieldCheck, UserCog, UserCheck, ShieldAlert, 
  Shield, Ban, Lock, Loader2, UserX, Check, Mail
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyData } from "@/hooks/use-company-data";
import { usePermission } from "@/contexts/permission-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CompanyUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  twoFactorEnabled: boolean;
}

export default function UsersPage() {
  const { company, isLoading: companyLoading } = useCompanyData();
  const { isAdmin, role: currentRole } = usePermission();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Finance");
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
    if (!company || !company.id) return;
    try {
      await apiClient.put(`/users/update-role`, {
        userId,
        companyId: company.id,
        role: targetRole,
      });
      toast.success(`Peran berhasil diubah menjadi ${targetRole}`);
      fetchUsers(company.id);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah peran");
    }
  };

  const handleRemoveUser = async (userId: string, name: string) => {
    if (!company || !company.id) return;
    if (!confirm(`Hapus akses ${name} dari perusahaan ini?`)) return;

    try {
      await apiClient.post(`/users/remove-user`, {
        userId,
        companyId: company.id,
      });
      toast.success(`Pengguna ${name} berhasil dihapus dari perusahaan`);
      fetchUsers(company.id);
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus pengguna");
    }
  };

  const handleInvite = async () => {
    if (!company || !company.id) return;
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Nama dan email wajib diisi");
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
      toast.success(`Undangan berhasil dikirim ke ${inviteEmail}`);
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Finance");
      fetchUsers(company.id);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengundang pengguna");
    } finally {
      setIsInviting(false);
    }
  };

  const handleMfaToggle = async (userId: string, currentStatus: boolean, name: string) => {
    if (!company || !company.id) return;

    try {
      await apiClient.put(`/users/update-mfa-status`, {
        userId,
        companyId: company.id,
        enabled: !currentStatus
      });
      toast.success(`2FA ${!currentStatus ? 'Diaktifkan' : 'Dinonaktifkan'} untuk ${name}`);
      fetchUsers(company.id);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah status 2FA");
    }
  };

  const getRoleBadge = (roleStr: string) => {
    const clean = roleStr.toLowerCase();
    switch (clean) {
      case "superadmin":
      case "owner":
        return <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 font-mono text-[10px]">Superadmin</Badge>;
      case "admin":
      case "manager":
        return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 font-mono text-[10px]">Admin</Badge>;
      case "finance":
      case "staff":
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 font-mono text-[10px]">Finance</Badge>;
      case "auditor":
      case "viewer":
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 font-mono text-[10px]">Auditor (Read-Only)</Badge>;
      default:
        return <Badge variant="secondary" className="font-mono text-[10px]">{roleStr}</Badge>;
    }
  };

  // ── RBAC GUARD SCREEN FOR NON-ADMINS (FINANCE / AUDITOR) ──────────────────
  if (!isAdmin) {
    return (
      <div className="flex-1 space-y-4">
        <Card className="border-border/60 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
              <Lock className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-display text-xl font-bold text-foreground">
                Akses Terbatas: Manajemen Pengguna
              </h3>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Anda masuk sebagai peran <strong className="text-foreground font-semibold">{currentRole}</strong>. Berdasarkan kebijakan kontrol internal dan pemisahan tugas (RBAC), halaman pengaturan pengguna dan otorisasi hanya dapat diakses oleh peran <strong>Admin</strong> atau <strong>Superadmin</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Manajemen Pengguna & Otorisasi</h3>
          <p className="text-xs text-muted-foreground font-mono">
            Kelola peran anggota tim dan hak akses pada perusahaan.
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs font-mono">
              <Plus className="h-3.5 w-3.5" /> Unduh / Tambah Pengguna
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Undang Anggota Tim Baru</DialogTitle>
              <DialogDescription>
                Pilih peran RBAC yang sesuai untuk mengatur batasan akses pengguna pada sistem akuntansi.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 text-xs font-mono">
              <div className="grid gap-1.5">
                <Label className="font-semibold">Nama Lengkap *</Label>
                <Input
                  placeholder="Contoh: Budi Santoso"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="text-xs font-sans"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="font-semibold">Alamat Email *</Label>
                <Input
                  type="email"
                  placeholder="Contoh: budi@perusahaan.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="font-semibold">Peran & Hak Akses (RBAC) *</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin" className="text-xs font-mono">
                      Admin — Akses Penuh & Manajemen Pengguna
                    </SelectItem>
                    <SelectItem value="Finance" className="text-xs font-mono">
                      Finance — Operasional Keuangan & Akuntansi (Tanpa Akses Pengguna)
                    </SelectItem>
                    <SelectItem value="Auditor" className="text-xs font-mono">
                      Auditor — Akses Hanya Baca (Read-Only) untuk Pengawasan Kepatuhan
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Batal</Button>
              <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim() || !inviteName.trim()}>
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                Kirim Undangan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {isLoading || companyLoading ? (
          <div className="h-32 flex items-center justify-center border rounded-lg bg-muted/20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-xs font-mono text-muted-foreground">Memuat daftar pengguna...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center border rounded-lg bg-card text-muted-foreground font-mono text-xs">
            Belum ada pengguna terdaftar untuk perusahaan ini.
          </div>
        ) : (
          users.map((user, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={user.userId}
              className="flex items-center justify-between p-3.5 rounded-lg border bg-card/60 hover:bg-card transition-colors text-xs font-mono"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border">
                  <AvatarFallback className="bg-muted text-foreground font-semibold text-xs font-mono">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    {user.name}
                    {user.twoFactorEnabled && (
                      <span title="2FA Aktif" className="text-emerald-600">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getRoleBadge(user.role)}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 text-xs font-mono">
                    <DropdownMenuLabel>Ubah Peran RBAC</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleUpdateRole(user.userId, "Admin")}>
                      Jadikan Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateRole(user.userId, "Finance")}>
                      Jadikan Finance
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateRole(user.userId, "Auditor")}>
                      Jadikan Auditor (Read-Only)
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Keamanan & Akses</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleMfaToggle(user.userId, user.twoFactorEnabled, user.name)}>
                      {user.twoFactorEnabled ? (
                        <>
                          <Ban className="mr-2 h-3.5 w-3.5 text-destructive" /> Nonaktifkan 2FA
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-3.5 w-3.5 text-emerald-600" /> Aktifkan 2FA
                        </>
                      )}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleRemoveUser(user.userId, user.name)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <UserX className="mr-2 h-3.5 w-3.5" /> Hapus Akses
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
