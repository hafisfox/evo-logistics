"use client";

import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid
} from "recharts";
import { MoveUpRight } from "lucide-react";

const data = [
    { name: "Jan", thisPeriod: 300000, lastPeriod: 250000 },
    { name: "Feb", thisPeriod: 280000, lastPeriod: 260000 },
    { name: "Mar", thisPeriod: 450000, lastPeriod: 300000 },
    { name: "Apr", thisPeriod: 350000, lastPeriod: 320000 },
    { name: "May", thisPeriod: 200000, lastPeriod: 220000 },
    { name: "Jun", thisPeriod: 250000, lastPeriod: 240000 },
    { name: "Jul", thisPeriod: 400000, lastPeriod: 280000 },
    { name: "Aug", thisPeriod: 550000, lastPeriod: 350000 },
    { name: "Sep", thisPeriod: 500000, lastPeriod: 380000 },
    { name: "Oct", thisPeriod: 450000, lastPeriod: 400000 },
    { name: "Nov", thisPeriod: 400000, lastPeriod: 420000 },
    { name: "Dec", thisPeriod: 400000, lastPeriod: 420000 },
];

export function ProfitChart() {
    return (
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm h-full">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Profit over time</h3>
                <div className="flex gap-2">
                    <select className="text-xs border rounded-full px-3 py-1 bg-transparent text-gray-500 outline-none">
                        <option>Monthly</option>
                    </select>
                    <select className="text-xs border rounded-full px-3 py-1 bg-transparent text-gray-500 outline-none">
                        <option>2024</option>
                    </select>
                </div>
            </div>

            <div className="flex items-baseline gap-4 mb-8">
                <span className="text-3xl font-light text-gray-900 dark:text-white">$612,375.37</span>
                <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                    <MoveUpRight className="h-4 w-4" />
                    <span>+3%</span>
                </div>
                <span className="text-xs text-gray-500">From last month</span>

                <div className="ml-auto flex gap-4 text-xs font-medium">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                        <span className="text-gray-500">This period</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-gray-300"></span>
                        <span className="text-gray-500">Last period</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorThisPeriod" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#6B7280' }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#6B7280' }}
                            tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="lastPeriod"
                            stroke="#D1D5DB"
                            strokeWidth={2}
                            fill="none"
                        />
                        <Area
                            type="monotone"
                            dataKey="thisPeriod"
                            stroke="#F97316"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorThisPeriod)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
