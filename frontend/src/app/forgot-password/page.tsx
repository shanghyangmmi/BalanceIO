"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react"
import { useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { BackgroundPattern } from "@/components/ui/background-pattern"
import { Spotlight } from "@/components/ui/spotlight"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            })

            // We always show success to prevent email enumeration, unless it's a network error
            if (!res.ok && res.status >= 500) {
                throw new Error("Server error. Please try again later.")
            }

            setIsSubmitted(true)
        } catch (err: any) {
            setError(err.message || "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-6 right-6 z-20">
                <ThemeToggle />
            </div>
            <BackgroundPattern />
            <Spotlight className="-top-40 left-0 text-emerald-500/20 dark:text-emerald-400/20" />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
                className="relative z-10 w-full max-w-[440px] mx-4"
            >
                <div className="rounded-3xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-black/40 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl ring-1 ring-black/5 dark:ring-white/5">

                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
                            <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg shadow-[#0B3C3D]/30">
                                <img src="/images/logo-icon.svg" alt={siteConfig.name} className="h-full w-full object-cover" />
                            </div>
                            <span className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight group-hover:text-[#0B3C3D] dark:group-hover:text-emerald-400 transition-colors">{siteConfig.name}</span>
                        </Link>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Reset Password</h1>
                        <p className="text-zinc-500 text-sm">Enter your email to receive a reset link</p>
                    </div>

                    {isSubmitted ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6"
                        >
                            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Check your email</h3>
                                <p className="text-zinc-500 text-sm">
                                    If an account exists for <strong>{email}</strong>, we've sent instructions to reset your password.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setIsSubmitted(false)}
                            >
                                Try another email
                            </Button>
                            <Link href="/login" className="block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                Back to Login
                            </Link>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-400">Email address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                    <Input
                                        type="email"
                                        placeholder="name@company.com"
                                        className="pl-10 h-11 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="text-sm text-red-500 font-medium bg-red-50 dark:bg-red-900/10 p-3 rounded-lg text-center">
                                    {error}
                                </p>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading || !email}
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#0B3C3D] to-[#134e4f] hover:from-[#092f30] hover:to-[#0f3d3e] text-white font-bold shadow-lg shadow-[#0B3C3D]/20 transition-all"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Reset Link"
                                )}
                            </Button>

                            <Link
                                href="/login"
                                className="flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors group"
                            >
                                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                                Back to Login
                            </Link>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
