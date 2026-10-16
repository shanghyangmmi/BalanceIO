"use client";

import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    AreaChart,
    Area
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { Loader2, TrendingUp, PieChart as PieIcon, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatter";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function AnalyticsTab() {
    const [expenseData, setExpenseData] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [salesTrend, setSalesTrend] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [expenses, products, trend] = await Promise.all([
                    apiClient.getExpenseBreakdown().catch(() => []),
                    apiClient.getTopProducts().catch(() => []),
                    apiClient.getSalesTrend().catch(() => [])
                ]);
                setExpenseData(expenses || []);
                setTopProducts(products || []);
                setSalesTrend(trend || []);
            } catch (error) {
                console.error("Failed to fetch analytics", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

            {/* Sales Trend (Line/Area Chart) - Spans 4 columns */}
            <Card className="col-span-4 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        Revenue Trend
                    </CardTitle>
                    <CardDescription>Daily revenue performance for this month</CardDescription>
                </CardHeader>
                <CardContent className="pl-0">
                    <div className="h-[300px] w-full" style={{ minHeight: 300, minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={salesTrend}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`} // Simplified for space
                                />
                                <Tooltip
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorTotal)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Expense Breakdown (Pie Chart) - Spans 3 columns */}
            <Card className="col-span-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieIcon className="h-5 w-5 text-rose-500" />
                        Expense Breakdown
                    </CardTitle>
                    <CardDescription>Top spending categories</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full" style={{ minHeight: 300, minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                                <Pie
                                    data={expenseData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="total"
                                    nameKey="accountName"
                                >
                                    {expenseData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Top Products (Bar Chart) - Full Width */}
            <Card className="col-span-7 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        Top Performing Products
                    </CardTitle>
                    <CardDescription>By revenue generated</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full" style={{ minHeight: 300, minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="productName"
                                    type="category"
                                    width={150}
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar
                                    dataKey="revenue"
                                    fill="#3b82f6"
                                    radius={[0, 4, 4, 0]}
                                    barSize={30}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
