"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { usePlanCheckout } from "@/components/billing/plan-checkout";
import { useCompanyData } from "@/hooks/use-company-data";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCan, RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface Plan {
    id: string;
    name: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    features: string;
    maxUsers: number;
    maxCompanies: number;
    isPopular: boolean;
}

interface CurrentSubscription {
    id: string;
    plan: {
        id: string;
        name: string;
        priceMonthly: number;
    };
    status: string;
    endDate: string;
    billingCycle: string;
    autoRenew: boolean;
}

function BillingPageContent() {
    const can = useCan();
    const { company } = useCompanyData();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentSub, setCurrentSub] = useState<CurrentSubscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [plansData, subData] = await Promise.all([
                    apiClient.get<Plan[]>("/plans"),
                    company?.id ? apiClient.get<CurrentSubscription>(`/subscriptions/current/${company.id}`) : null
                ]);
                setPlans(plansData);
                if (subData) setCurrentSub(subData);
            } catch (error) {
                console.error("Failed to fetch billing data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [company?.id]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(price);
    };

    const checkout = usePlanCheckout();
    const handleUpgrade = (planId: string) => {
        if (!company?.id) return;
        checkout.start({ planId, billingCycle });
    };

    const getPlanIcon = (name: string) => {
        switch (name.toLowerCase()) {
            case "free": return <Sparkles className="h-6 w-6" />;
            case "pro": return <Zap className="h-6 w-6" />;
            case "enterprise": return <Crown className="h-6 w-6" />;
            default: return <Sparkles className="h-6 w-6" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading billing info...</div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gradient">Billing & Subscription</h2>
                    <p className="text-muted-foreground">Manage your subscription and billing</p>
                </div>
                <Link href="/dashboard/settings/billing/history">
                    <Button variant="outline">Payment History</Button>
                </Link>
            </div>

            {/* Current Plan */}
            {currentSub && (
                <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
                    <CardHeader>
                        <CardTitle className="text-lg">Current Plan</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Badge className="bg-emerald-500 text-white text-lg px-4 py-1">
                                {currentSub.plan.name}
                            </Badge>
                            <span className="text-muted-foreground">
                                {currentSub.billingCycle === "Monthly" ? "Billed monthly" : "Billed yearly"}
                            </span>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold">{formatPrice(currentSub.plan.priceMonthly)}</div>
                            <div className="text-sm text-muted-foreground">/month</div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Billing Cycle Toggle */}
            <div className="flex justify-center gap-2">
                <Button
                    variant={billingCycle === "monthly" ? "default" : "outline"}
                    onClick={() => setBillingCycle("monthly")}
                >
                    Monthly
                </Button>
                <Button
                    variant={billingCycle === "yearly" ? "default" : "outline"}
                    onClick={() => setBillingCycle("yearly")}
                >
                    Yearly <Badge className="ml-2 bg-green-500">Save 17%</Badge>
                </Button>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-6">
                {plans.map((plan, idx) => {
                    const features = plan.features ? JSON.parse(plan.features) : [];
                    const price = billingCycle === "yearly" ? plan.priceYearly / 12 : plan.priceMonthly;
                    const isCurrentPlan = currentSub?.plan.name === plan.name;

                    return (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <Card className={`relative h-full ${plan.isPopular ? "border-2 border-emerald-500 shadow-lg" : ""}`}>
                                {plan.isPopular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <Badge className="bg-emerald-500 text-white">Most Popular</Badge>
                                    </div>
                                )}
                                <CardHeader className="text-center pb-2">
                                    <div className="mx-auto mb-2 p-3 rounded-full bg-muted w-fit">
                                        {getPlanIcon(plan.name)}
                                    </div>
                                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                                    <CardDescription>{plan.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="text-center">
                                        <span className="text-4xl font-bold">{formatPrice(price)}</span>
                                        <span className="text-muted-foreground">/month</span>
                                        {billingCycle === "yearly" && (
                                            <div className="text-sm text-muted-foreground">
                                                Billed {formatPrice(plan.priceYearly)}/year
                                            </div>
                                        )}
                                    </div>

                                    <ul className="space-y-2">
                                        {features.map((feature: string, i: number) => (
                                            <li key={i} className="flex items-center gap-2 text-sm">
                                                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    {can(PERMISSIONS.SettingsManage) && <Button
                                        className={`w-full ${plan.isPopular ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                                        variant={plan.isPopular ? "default" : "outline"}
                                        disabled={isCurrentPlan}
                                        onClick={() => handleUpgrade(plan.id)}
                                    >
                                        {isCurrentPlan ? "Current Plan" : plan.priceMonthly === 0 ? "Get Started" : "Upgrade"}
                                    </Button>}
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>
            {checkout.dialog}
        </div>
    );
}

// The page's data is readable only with Settings.View; without it, say so
// rather than firing requests the API refuses.
export default function BillingPage() {
  return (
    <RBACGuard permission={PERMISSIONS.SettingsView} fallback={<NoPermission permission={PERMISSIONS.SettingsView} />}>
      <BillingPageContent />
    </RBACGuard>
  );
}
