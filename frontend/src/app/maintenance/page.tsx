"use client";

import { Wrench, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function MaintenancePage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 max-w-md w-full text-center space-y-8"
            >
                <div className="relative inline-block">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-4 border-2 border-dashed border-amber-500/20 rounded-full"
                    />
                    <div className="h-24 w-24 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-900/30">
                        <Wrench className="h-10 w-10 text-amber-500" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Under Maintenance
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                        We're currently improving our system to serve you better.
                        Please check back in a few minutes.
                    </p>
                </div>

                <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border rounded-lg p-4 max-w-sm mx-auto">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span>Expected duration: ~15 minutes</span>
                    </div>
                </div>

                <div className="pt-4">
                    <Button
                        size="lg"
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => window.location.href = "/"}
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                    </Button>
                </div>
            </motion.div>

            <div className="absolute bottom-8 text-center text-xs text-muted-foreground">
                <p>&copy; {new Date().getFullYear()} BalanceIO. All rights reserved.</p>
            </div>
        </div>
    );
}
