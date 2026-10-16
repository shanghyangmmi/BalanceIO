"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatter";

const metrics = [
  {
    title: "Opening Balance",
    value: 450000000,
    change: "+5.2%",
    trend: "up",
    icon: DollarSign,
  },
  {
    title: "Cash Inflow",
    value: 125000000,
    change: "+12.3%",
    trend: "up",
    icon: TrendingUp,
  },
  {
    title: "Cash Outflow",
    value: 85000000,
    change: "-2.1%",
    trend: "down",
    icon: TrendingDown,
  },
  {
    title: "Net Cash Flow",
    value: 40000000,
    change: "+15.4%",
    trend: "up",
    icon: DollarSign,
  },
];

const chartData = [
  { name: "Week 1", balance: 450000000 },
  { name: "Week 2", balance: 480000000 },
  { name: "Week 3", balance: 465000000 },
  { name: "Week 4", balance: 490000000 },
];

export default function CashFlowDashboardPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gradient">
            Cash Flow Dashboard
          </h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(metric.value)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {metric.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={
                    metric.trend === "up" ? "text-green-500" : "text-red-500"
                  }
                >
                  {metric.change}
                </span>{" "}
                from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Cash Position Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-end gap-2 px-2">
            {chartData.map((data) => (
              <div
                key={data.name}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div
                  className="w-full bg-primary/20 rounded-t-md hover:bg-primary/30 transition-colors cursor-pointer relative group"
                  style={{ height: `${(data.balance / 500000000) * 100}%` }}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {formatCurrency(data.balance)}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {data.name}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
