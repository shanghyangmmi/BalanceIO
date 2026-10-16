"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"

interface OverviewData {
    name: string
    total: number
}

export function Overview() {
    const [data, setData] = useState<OverviewData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            try {
                const result = await apiClient.get<OverviewData[]>("/dashboard/overview")
                setData(result)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    if (loading) {
        return (
            <div className="h-[350px] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/50 rounded-lg animate-pulse">
                <div className="text-zinc-400">Loading chart data...</div>
            </div>
        )
    }

    if (data.length === 0) {
        return (
            <div className="h-[350px] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                <div className="text-zinc-400">No data available</div>
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
                <XAxis
                    dataKey="name"
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
                    tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Revenue']}
                />
                <Bar
                    dataKey="total"
                    fill="currentColor"
                    radius={[4, 4, 0, 0]}
                    className="fill-primary"
                />
            </BarChart>
        </ResponsiveContainer>
    )
}
