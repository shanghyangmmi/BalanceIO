"use client";

import { useState, useEffect } from "react"
import { BarChart3, Lock, Zap, Globe, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const features = [
    {
        id: 0,
        name: "Real-time Analytics",
        description: "Watch your financial pulse instantly. Every transaction, every second.",
        icon: BarChart3,
        color: "bg-emerald-50 text-emerald-600"
    },
    {
        id: 1,
        name: "Total Security",
        description: "Bank-grade encryption locks your data tight. Sleep soundly.",
        icon: Lock,
        color: "bg-blue-50 text-blue-600"
    },
    {
        id: 2,
        name: "Zero Latency",
        description: "Speed that keeps up with thought. No loading spinners here.",
        icon: Zap,
        color: "bg-amber-50 text-amber-600"
    },
    {
        id: 3,
        name: "Global Scale",
        description: "Multi-currency. Multi-entity. One unified dashboard.",
        icon: Globe,
        color: "bg-purple-50 text-purple-600"
    },
]

export function Features() {
    const [activeindex, setActiveIndex] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % features.length)
        }, 4000)
        return () => clearInterval(timer)
    }, [])

    return (
        <section className="relative py-24 bg-gradient-to-b from-white to-slate-100 overflow-hidden">

            {/* Background Texture & Depth */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Noise Texture */}
                <div className="absolute inset-0 bg-noise opacity-[0.03]" />

                {/* Tech Grid */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02]" />

                {/* Vertical Soft Glows - Centered Axis */}
                <div className="absolute top-0 left-1/2 w-[1000px] h-[600px] bg-teal-50/50 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 mix-blend-multiply" />
                <div className="absolute bottom-0 left-1/2 w-[1000px] h-[600px] bg-blue-50/50 rounded-full blur-[120px] -translate-x-1/2 translate-y-1/2 mix-blend-multiply" />
            </div>

            <div className="mx-auto max-w-6xl px-8 md:px-12 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    {/* Left Side: Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                        className="space-y-8"
                    >
                        <h2 className="text-5xl font-bold font-serif text-[#0B3C3D] leading-[1.1]">
                            Everything you need.<br />
                            <span className="text-[#0B3C3D]/40 italic font-light">Zero clutter.</span>
                        </h2>
                        <p className="text-lg text-[#1C1F24]/70 leading-relaxed max-w-md">
                            Powerful features packed into a simple interface. We handle the complexity so you can focus on growth.
                        </p>

                        {/* Progress Indicators */}
                        <div className="flex gap-3 pt-4">
                            {features.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveIndex(idx)}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeindex
                                        ? "w-8 bg-[#0B3C3D]"
                                        : "w-2 bg-[#0B3C3D]/20 hover:bg-[#0B3C3D]/40"
                                        }`}
                                />
                            ))}
                        </div>
                    </motion.div>

                    {/* Right Side: The Deck */}
                    <div className="relative h-[400px] w-full flex items-center justify-center lg:justify-end [perspective:1000px]">
                        <AnimatePresence mode="popLayout">
                            {features.map((feature, index) => {
                                // Only render active and next card for performance/logic
                                if (index !== activeindex && index !== (activeindex + 1) % features.length) return null

                                const isActive = index === activeindex

                                return (
                                    <motion.div
                                        key={feature.id}
                                        initial={isActive ? { opacity: 0, scale: 0.9, z: -100, rotateX: -10 } : { opacity: 0, scale: 0.8, z: -200 }}
                                        animate={isActive
                                            ? { opacity: 1, scale: 1, z: 0, rotateX: 0, y: 0 }
                                            : { opacity: 0.5, scale: 0.95, z: -50, rotateX: 10, y: -20 } // The "Next" card lurking behind
                                        }
                                        exit={{ opacity: 0, y: 100, rotateX: 20, z: 100 }} // Drop down when done
                                        transition={{ duration: 0.6, ease: "easeInOut" }}
                                        className={`absolute w-full max-w-sm p-8 rounded-3xl border border-white/60 bg-white shadow-2xl shadow-slate-200/50 ${isActive ? 'z-20' : 'z-10'}`}
                                        style={{ transformStyle: "preserve-3d" }}
                                    >
                                        <div className="flex flex-col gap-6">
                                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${feature.color}`}>
                                                <feature.icon className="h-7 w-7" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-800 mb-3">
                                                    {feature.name}
                                                </h3>
                                                <p className="text-slate-500 font-medium leading-relaxed">
                                                    {feature.description}
                                                </p>
                                            </div>
                                            <div className="flex items-center text-sm font-bold text-slate-800 gap-2 mt-2">
                                                Learn more <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>

                        {/* Decorative background blob for the deck */}
                        <div className="absolute top-1/2 left-3/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#0B3C3D]/5 rounded-full blur-3xl -z-10 animate-pulse-slow" />
                    </div>
                </div>
            </div>
        </section>
    )
}
