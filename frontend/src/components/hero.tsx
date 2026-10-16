"use client";

import React, { useEffect, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, Activity, CheckCircle2, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import heroBg from "@/assets/images/hero_bg.png";
import { Button } from "@/components/ui/button";

// --- TYPEWRITER COMPONENT ---
const TypewriterText = () => {
    const words = [
        "More Accurate.",
        "More Secure.",
        "More Refined."
    ];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % words.length);
        }, 4000); // Slower: 4 seconds
        return () => clearInterval(interval);
    }, [words.length]);

    return (
        <span className="inline-grid h-[1.2em] overflow-hidden align-top">
            <AnimatePresence mode="wait">
                <motion.span
                    key={index}
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: "0%", opacity: 1 }}
                    exit={{ y: "-100%", opacity: 0 }}
                    transition={{ duration: 0.8, ease: "circOut" }} // Slower transition
                    className="col-start-1 col-end-2 font-extrabold text-[#D97706] block drop-shadow-sm"
                >
                    {words[index]}
                </motion.span>
            </AnimatePresence>
        </span>
    );
};

export function Hero() {
    const { scrollY } = useScroll();
    const y = useTransform(scrollY, [0, 500], [0, -50]);
    const rotateX = useTransform(scrollY, [0, 500], [0, 10]);

    return (
        <section className="relative w-full overflow-hidden bg-background text-foreground antialiased min-h-screen flex flex-col items-center pt-24 md:pt-32">

            {/* --- QUIET LUXURY MARBLE BACKGROUND --- */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <Image
                    src={heroBg}
                    alt="Background Pattern"
                    fill
                    className="object-cover opacity-60 dark:opacity-20 dark:invert"
                    placeholder="blur"
                    priority
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#C7CCD1_1px,transparent_1px),linear-gradient(to_bottom,#C7CCD1_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.1] dark:opacity-[0.05] z-10"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/50 to-background z-20"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl px-4 flex flex-col items-center text-center">

                {/* --- HEADLINE --- */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative z-10 text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl text-foreground dark:text-white"
                >
                    Refined Accounting Environment
                </motion.h1>

                {/* --- SUBTITLE --- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="mt-8 max-w-2xl text-lg md:text-xl font-light leading-relaxed text-muted-foreground"
                >
                    <div className="mt-4 text-2xl font-light">
                        <TypewriterText />
                    </div>
                </motion.div>

                {/* --- CTA BUTTONS --- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-10 flex flex-col sm:flex-row gap-4 w-full justify-center items-center"
                >
                    <Link href="/dashboard">
                        <Button className="h-14 px-8 rounded-full text-base font-medium transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 min-w-[200px] relative overflow-hidden group bg-transparent border-none">
                            <span className="absolute inset-0 bg-[linear-gradient(110deg,#0B3C3D,45%,#134e4f,55%,#0B3C3D)] bg-[length:200%_100%] animate-shimmer" />
                            <span className="relative text-[#FBFBF9] flex items-center justify-center">
                                Get Started
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Button>
                    </Link>
                </motion.div>

                {/* --- DASHBOARD PREVIEW --- */}
                {/* --- DASHBOARD PREVIEW --- */}
                <motion.div
                    style={{ y, rotateX }}
                    animate={{ y: [0, -10, 0] }}
                    transition={{
                        y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="relative mt-20 w-full max-w-5xl perspective-[2000px]"
                >
                    <LiveDashboardPreview />

                    {/* Shadow/Glow */}
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[90%] h-20 bg-[#0B3C3D] blur-[100px] opacity-10 -z-10 rounded-full"></div>
                </motion.div>
            </div>
        </section>
    );
}

// --- LIVE DASHBOARD COMPONENT ---
const LiveDashboardPreview = () => {
    // 12 Months of Data
    const data = [
        { month: 'Jan', revenue: 30, assets: 3.2, profit: 650, runway: 12 },
        { month: 'Feb', revenue: 45, assets: 3.4, profit: 720, runway: 13 },
        { month: 'Mar', revenue: 40, assets: 3.3, profit: 680, runway: 14 },
        { month: 'Apr', revenue: 60, assets: 3.8, profit: 800, runway: 15 },
        { month: 'May', revenue: 55, assets: 3.7, profit: 750, runway: 16 },
        { month: 'Jun', revenue: 75, assets: 4.1, profit: 890, runway: 18 },
        { month: 'Jul', revenue: 70, assets: 4.0, profit: 850, runway: 19 },
        { month: 'Aug', revenue: 85, assets: 4.6, profit: 1050, runway: 21 },
        { month: 'Sep', revenue: 80, assets: 4.5, profit: 1000, runway: 22 },
        { month: 'Oct', revenue: 90, assets: 5.1, profit: 1250, runway: 24 },
        { month: 'Nov', revenue: 95, assets: 5.4, profit: 1380, runway: 26 },
        { month: 'Dec', revenue: 100, assets: 5.8, profit: 1540, runway: 28 },
    ];

    const [currentMonth, setCurrentMonth] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMonth((prev) => (prev + 1) % data.length);
        }, 800); // Update every 0.8 seconds
        return () => clearInterval(interval);
    }, []);

    const currentData = data[currentMonth];

    // Calculate changes
    const getChange = (current: number, prev: number) => {
        if (currentMonth === 0) return "0";
        return ((current - prev) / prev * 100).toFixed(1);
    };

    const assetChange = parseFloat(getChange(currentData.assets, data[currentMonth - 1]?.assets || currentData.assets));
    const profitChange = parseFloat(getChange(currentData.profit, data[currentMonth - 1]?.profit || currentData.profit));

    return (
        <div className="relative rounded-xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden ring-1 ring-primary/5">

            {/* Dashboard Header */}
            <div className="flex items-center justify-between border-b border-border/50 bg-card/90 px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-border"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-border"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-border"></div>
                </div>
                <div className="flex items-center gap-2 rounded-full px-3 py-1 bg-primary/5 text-primary border border-primary/10 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                    <span className="relative flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    Live System
                </div>
            </div>

            {/* Dashboard Body */}
            <div className="p-6 md:p-8 bg-background/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Chart Card */}
                    <div className="md:col-span-2 p-6 rounded-xl border border-border/40 bg-card shadow-sm flex flex-col justify-end">
                        <h3 className="text-card-foreground text-xs font-bold uppercase tracking-widest mb-4">Revenue Growth (YTD)</h3>
                        <div className="h-48 w-full flex items-end gap-2 pr-4 border-b border-l border-dashed border-border/50">
                            {data.map((d, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{
                                        height: i <= currentMonth ? `${d.revenue}%` : "0%",
                                        opacity: i <= currentMonth ? 1 : 0.3
                                    }}
                                    transition={{ duration: 0.3 }}
                                    className={`flex-1 rounded-t-sm relative group ${i === currentMonth ? "bg-primary" : "bg-primary/20"}`}
                                >
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Stats List */}
                    <div className="space-y-4">
                        {/* Total Assets */}
                        <div className="p-4 rounded-xl border border-border/40 bg-card shadow-sm flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Assets</span>
                            <div className="flex justify-between items-end mt-2">
                                <span className="text-2xl font-mono text-primary font-medium">
                                    ${currentData.assets}M
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center ${assetChange >= 0
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-red-500/10 text-red-600"
                                    }`}>
                                    {assetChange >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <Activity className="w-3 h-3 mr-1 rotate-180" />}
                                    {Math.abs(assetChange)}%
                                </span>
                            </div>
                        </div>

                        {/* Net Profit */}
                        <div className="p-4 rounded-xl border border-border/40 bg-card shadow-sm flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Net Profit</span>
                            <div className="flex justify-between items-end mt-2">
                                <span className="text-2xl font-mono text-primary font-medium">
                                    ${currentData.profit}K
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center ${profitChange >= 0
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-red-500/10 text-red-600"
                                    }`}>
                                    {profitChange >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <Activity className="w-3 h-3 mr-1 rotate-180" />}
                                    {Math.abs(profitChange)}%
                                </span>
                            </div>
                        </div>

                        {/* Runway */}
                        <div className="p-4 rounded-xl border border-border/40 bg-card shadow-sm flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Runway</span>
                            <div className="flex justify-between items-end mt-2">
                                <span className="text-2xl font-mono text-primary font-medium">
                                    {currentData.runway} Mo
                                </span>
                                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                                    Stable
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};


