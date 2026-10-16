"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { Eye, EyeOff, Loader2, CheckCircle, Lock, AlertCircle } from "lucide-react"
import { useState, Suspense } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { BackgroundPattern } from "@/components/ui/background-pattern"
import { Spotlight } from "@/components/ui/spotlight"
import { useSearchParams } from "next/navigation"

function ResetPasswordContent() {

    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token) {
            setError("Invalid or missing reset token.")
            return
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.")
            return
        }

        setIsLoading(true)
        setError("")

        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || "Failed to reset password")
            }

            setIsSuccess(true)
            // Redirect after 3s
            setTimeout(() => window.location.href = "/login", 3000)

        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    if (!token) {
        return (
            <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Invalid Link</h3>
                <p className="text-zinc-500 text-sm">
                    This password reset link is invalid or has expired. Please request a new one.
                </p>
                <Button asChild className="w-full">
                    <Link href="/forgot-password">Request New Link</Link>
                </Button>
            </div>
        )
    }

    if (isSuccess) {
        return (
            <div className="text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Password Reset Complete</h3>
                    <p className="text-zinc-500 text-sm">
                        Your password has been updated successfully. Redirecting to login...
                    </p>
                </div>
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Link href="/login">Go to Login</Link>
                </Button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-400">New Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10 h-11 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-400">Confirm Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 h-11 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-500 font-medium bg-red-50 dark:bg-red-900/10 p-3 rounded-lg text-center">
                    {error}
                </p>
            )}

            <Button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#0B3C3D] to-[#134e4f] hover:from-[#092f30] hover:to-[#0f3d3e] text-white font-bold shadow-lg shadow-[#0B3C3D]/20 transition-all"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                    </>
                ) : (
                    "Set New Password"
                )}
            </Button>
        </form>
    )
}

export default function ResetPasswordPage() {
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
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Create New Password</h1>
                        <p className="text-zinc-500 text-sm">Your new password must be different from previous used passwords.</p>
                    </div>

                    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-emerald-500" /></div>}>
                        <ResetPasswordContent />
                    </Suspense>

                </div>
            </motion.div>
        </div>
    )
}
