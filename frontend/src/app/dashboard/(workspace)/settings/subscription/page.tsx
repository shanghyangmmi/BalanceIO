"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, CreditCard, Lock, Zap } from "lucide-react";
import { usePermission } from "@/contexts/permission-context";
import { toast } from "sonner";

const plans = [
  {
    name: "Starter",
    price: "Free",
    description:
      "Perfect for freelancers and small businesses just starting out.",
    features: [
      "Up to 3 Users",
      "Basic Accounting",
      "50 Invoices / mo",
      "Standard Support",
    ],
    current: false,
    color: "bg-slate-100 dark:bg-slate-800",
  },
  {
    name: "Professional",
    price: "Rp 150.000 / mo",
    description: "Everything you need to grow your business.",
    features: [
      "Unlimited Users",
      "Advanced Accounting",
      "Unlimited Invoices",
      "Inventory Management",
      "Assets Management",
      "Priority Support",
    ],
    current: true,
    color:
      "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Advanced features and support for large organizations.",
    features: [
      "Everything in Pro",
      "Custom Integrations",
      "Dedicated Account Manager",
      "SLA Support",
      "Audit Logs",
    ],
    current: false,
    color: "bg-slate-100 dark:bg-slate-800",
  },
];

export default function SubscriptionPage() {
  const { isAdmin, role: currentRole } = usePermission();

  const handleUpgrade = (planName: string) => {
    toast.info(`Permintaan upgrade ke paket ${planName} telah dikirim.`);
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
                Akses Terbatas: Langganan & Penagihan
              </h3>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Anda masuk sebagai peran <strong className="text-foreground font-semibold">{currentRole}</strong>. Pengaturan paket langganan, metode pembayaran, dan tagihan perusahaan hanya dapat diakses oleh peran <strong>Admin</strong> atau <strong>Superadmin</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold">Paket Langganan & Penagihan</h3>
        <p className="text-xs text-muted-foreground font-mono">
          Kelola paket langganan aktif, metode pembayaran, dan riwayat tagihan perusahaan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`flex flex-col ${plan.color} relative ${plan.current ? "border-2 border-primary/50" : ""
              }`}
          >
            {plan.current && (
              <div className="absolute top-0 right-0 -mt-3 mr-4 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full font-mono">
                Paket Aktif
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex justify-between items-center font-display text-base">
                {plan.name}
              </CardTitle>
              <CardDescription className="text-xs font-sans">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 font-mono text-xs">
              <div className="text-2xl font-bold font-money text-foreground">{plan.price}</div>
              <ul className="space-y-2 text-xs text-muted-foreground font-sans">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full text-xs font-mono"
                variant={plan.current ? "outline" : "default"}
                onClick={() => !plan.current && handleUpgrade(plan.name)}
                disabled={plan.current}
              >
                {plan.current
                  ? "Paket Saat Ini"
                  : plan.price === "Custom"
                    ? "Hubungi Sales"
                    : "Upgrade Paket"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CreditCard className="h-4 w-4" /> Metode Pembayaran
          </CardTitle>
          <CardDescription className="text-xs font-mono">Kelola kartu kredit atau metode pembayaran perusahaan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between border p-4 rounded-md text-xs font-mono bg-muted/20">
            <div className="flex items-center gap-4">
              <div className="h-10 w-16 bg-muted rounded flex items-center justify-center font-bold text-foreground font-mono">
                VISA
              </div>
              <div>
                <p className="font-semibold text-foreground">Visa berakhir dengan 4242</p>
                <p className="text-[11px] text-muted-foreground">Kadaluarsa 12/2026</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-xs font-mono">
              Ubah
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full sm:w-auto text-xs font-mono">
            Tambah Metode Pembayaran
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-base">Riwayat Pembayaran</CardTitle>
          <CardDescription className="text-xs font-mono">Faktur tagihan langganan BalanceIO.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs font-mono">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold text-foreground">Faktur #INV-2026-00{i}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Dibayar pada {new Date().toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold font-money">Rp 150.000</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary text-xs font-mono"
                  >
                    Unduh PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
