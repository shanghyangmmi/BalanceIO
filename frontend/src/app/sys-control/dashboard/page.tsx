"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, CreditCard, TrendingUp, DollarSign } from "lucide-react";
import { adminApiClient } from "@/lib/api-client";
import { motion } from "framer-motion";

interface DashboardStats {
    overview: {
        totalUsers: number;
        totalCompanies: number;
        totalSubscriptions: number;
        activeSubscriptions: number;
    };
    revenue: {
        total: number;
        thisMonth: number;
        currency: string;
    };
    subscriptionsByPlan: { plan: string; count: number }[];
    recentPayments: {
        id: string;
        amount: number;
        status: string;
        createdAt: string;
    }[];
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await adminApiClient.get<DashboardStats>("/admin/dashboard");
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch admin stats:", error);
                // Fallback to empty data for development
                setStats({
                    overview: { totalUsers: 0, totalCompanies: 0, totalSubscriptions: 0, activeSubscriptions: 0 },
                    revenue: { total: 0, thisMonth: 0, currency: "IDR" },
                    subscriptionsByPlan: [],
                    recentPayments: []
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading admin dashboard...</div>
            </div>
        );
    }

    const statCards = [
        {
            title: "Total Users",
            value: stats?.overview.totalUsers || 0,
            icon: Users,
            color: "text-cyan-500",
            bg: "bg-cyan-500/10"
        },
        {
            title: "Total Companies",
            value: stats?.overview.totalCompanies || 0,
            icon: Building2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10"
        },
        {
            title: "Active Subscriptions",
            value: stats?.overview.activeSubscriptions || 0,
            icon: CreditCard,
            color: "text-zinc-500",
            bg: "bg-zinc-500/10"
        },
        {
            title: "Monthly Revenue",
            value: formatPrice(stats?.revenue.thisMonth || 0),
            icon: DollarSign,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            isPrice: true
        }
    ];

    return (
        <div className="flex-1 space-y-6 pt-6">
            <div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h2>
                <p className="text-muted-foreground">System-wide analytics and management</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, idx) => (
                    <motion.div
                        key={stat.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                    >
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                                <div className={`p-2 rounded-lg ${stat.bg}`}>
                                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {stat.isPrice ? stat.value : stat.value.toLocaleString()}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Subscriptions by Plan */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Subscriptions by Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.subscriptionsByPlan.map((item) => (
                                <div key={item.plan} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{item.plan}</Badge>
                                    </div>
                                    <span className="font-bold">{item.count}</span>
                                </div>
                            )) || (
                                    <div className="text-muted-foreground text-sm">No subscriptions yet</div>
                                )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Payments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.recentPayments.length ? stats.recentPayments.slice(0, 5).map((payment) => (
                                <div key={payment.id} className="flex items-center justify-between">
                                    <Badge
                                        className={
                                            payment.status === "Success"
                                                ? "bg-green-500"
                                                : payment.status === "Pending"
                                                    ? "bg-amber-500"
                                                    : "bg-gray-500"
                                        }
                                    >
                                        {payment.status}
                                    </Badge>
                                    <span className="font-bold">{formatPrice(payment.amount)}</span>
                                </div>
                            )) : (
                                <div className="text-muted-foreground text-sm">No payments yet</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Total Revenue */}
            <Card className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-200">
                <CardContent className="flex items-center justify-between py-6">
                    <div>
                        <p className="text-sm text-muted-foreground">Total Revenue (All Time)</p>
                        <p className="text-4xl font-bold">{formatPrice(stats?.revenue.total || 0)}</p>
                    </div>
                    <TrendingUp className="h-12 w-12 text-emerald-500" />
                </CardContent>
            </Card>
        </div>
    );
}
