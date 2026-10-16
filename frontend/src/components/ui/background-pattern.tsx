"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function BackgroundPattern() {
    return (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden bg-[#fafaf8] dark:bg-zinc-950">
            {/* 1. Base Gradient (Deep Atmosphere) */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#fafaf8] via-[#fafaf8]/60 to-[#fafaf8] dark:from-zinc-950 dark:via-zinc-950/80 dark:to-zinc-950 z-10" />

            {/* 2. The Grid (Structure) - Masked for Elegance */}
            <div
                className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 dark:opacity-20 transform perspective-[500px] rotate-x-12 scale-110"
            />

            {/* 3. Shooting Beams (The "Luxury" Factor) - High Contrast */}
            {/* Horizontal Beams */}
            <div className="absolute top-[15%] left-[-10%] w-[120%] h-[2px] bg-gradient-to-r from-transparent via-teal-600 to-transparent animate-scan-slow blur-[1px] opacity-100" />
            <div className="absolute top-[35%] left-[-10%] w-[120%] h-[2px] bg-gradient-to-r from-transparent via-emerald-600 to-transparent animate-scan-slower delay-700 blur-[1px] opacity-100" />
            <div className="absolute top-[80%] left-[-10%] w-[120%] h-[1px] bg-gradient-to-r from-transparent via-cyan-600/50 to-transparent animate-scan-slow delay-2000 blur-[0.5px] opacity-100" />

            {/* Vertical Beams */}
            <div className="absolute top-[-10%] left-[20%] w-[1px] h-[120%] bg-gradient-to-b from-transparent via-teal-600 to-transparent animate-scan-vertical delay-500 blur-[1px] opacity-100" />
            <div className="absolute top-[-10%] right-[20%] w-[1px] h-[120%] bg-gradient-to-b from-transparent via-emerald-600 to-transparent animate-scan-vertical delay-1500 blur-[1px] opacity-100" />


            {/* 4. Rich Aurora Orbs (Depth) */}
            <div className="absolute top-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-teal-500/20 dark:bg-teal-600/20 blur-[120px] animate-pulse-slow mix-blend-multiply dark:mix-blend-screen" />
            <div className="absolute top-[10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-500/20 dark:bg-emerald-600/10 blur-[120px] animate-pulse-slow delay-1000 mix-blend-multiply dark:mix-blend-screen" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-cyan-500/20 dark:bg-cyan-900/10 blur-[140px] animate-pulse-slow delay-500 opacity-50" />

            {/* 5. Divine Light (Top Center) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.15),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.25),transparent_70%)] pointer-events-none" />

            {/* 6. Noise Overlay (Texture) */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-soft-light z-20"></div>

            {/* 7. Vignette (Focus on Center) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.8)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(9,9,11,0.8)_120%)] z-20"></div>
        </div>
    )
}
