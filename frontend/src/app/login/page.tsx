"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { Eye, EyeOff, ArrowRight, Activity } from "lucide-react"
import { useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"

import { BackgroundPattern } from "@/components/ui/background-pattern"
import { Spotlight } from "@/components/ui/spotlight"
import { parseJwt } from "@/lib/utils"

export default function LoginPage() {

    const [showPassword, setShowPassword] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    // Auth State
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    // MFA State
    const [showMfa, setShowMfa] = useState(false)
    const [tempToken, setTempToken] = useState("")
    const [mfaCode, setMfaCode] = useState("")

    const validateEmail = (email: string) => {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        if (!validateEmail(email)) {
            setError("Please enter a valid email address (e.g., user@example.com)");
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            })

            const data = await res.json()

            if (res.status === 202 && data.requiresMFA) {
                setTempToken(data.tempToken)
                setShowMfa(true)
                setIsLoading(false)
                return
            }

            if (!res.ok) throw new Error(data.message || "Failed to login")

            // Success
            if (typeof window !== "undefined") {
                localStorage.setItem("token", data.token)
            }

            const user = parseJwt(data.token);
            // Check for standard role claim OR Microsoft specific role claim
            const role = user?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || user?.role || "";

            if (role === "Admin" || role === "SuperAdmin") {
                // Admins accessible via /sys-control/login
                // If they login here, they just get the user dashboard (if they have one) or empty state
                window.location.href = "/dashboard";
            } else {
                window.location.href = "/dashboard";
            }

        } catch (err: any) {
            let message = err.message || "Failed to login";

            // Handle network errors specifically
            if (message === "Failed to fetch") {
                message = "Network error. Please try again.";
            }

            setError(message)
            setIsLoading(false)
        }
    }

    const handleMfaVerify = async () => {
        setIsLoading(true)
        setError("")
        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/mfa/verify`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${tempToken}`
                },
                body: JSON.stringify({ code: mfaCode })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "Invalid Code")

            if (typeof window !== "undefined") {
                localStorage.setItem("token", data.token)
            }

            const user = parseJwt(data.token);
            // Check for standard role claim OR Microsoft specific role claim
            const role = user?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || user?.role || "";

            if (role === "Admin" || role === "SuperAdmin") {
                window.location.href = "/dashboard";
            } else {
                window.location.href = "/dashboard";
            }

        } catch (err: any) {
            setError(err.message)
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center relative overflow-hidden">
            {/* Theme Toggle */}
            <div className="absolute top-6 right-6 z-20">
                <ThemeToggle />
            </div>

            {/* Shared Background from Landing Page */}
            <BackgroundPattern />

            {/* Spotlight for Drama - Emerald/Teal for Auth Zone */}
            <Spotlight className="-top-40 left-0 text-emerald-500/20 dark:text-emerald-400/20" />

            {/* Main Container */}
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
                className="relative z-10 w-full max-w-[440px] mx-4"
            >
                {/* Card with hover effect */}
                <motion.div
                    className="rounded-3xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-black/40 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl ring-1 ring-black/5 dark:ring-white/5"
                    whileHover={{
                        boxShadow: "0 25px 60px -12px rgba(11, 60, 61, 0.15)",
                        borderColor: "rgba(11, 60, 61, 0.2)",
                    }}
                    transition={{ duration: 0.3 }}
                    onHoverStart={() => setIsHovered(true)}
                    onHoverEnd={() => setIsHovered(false)}
                >

                    {/* Logo & Header */}
                    <motion.div
                        className="text-center mb-10"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
                            <motion.div
                                className="h-12 w-12 rounded-2xl overflow-hidden shadow-lg shadow-[#0B3C3D]/30"
                                whileHover={{ scale: 1.1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                <img src="/images/logo-icon.svg" alt={siteConfig.name} className="h-full w-full object-cover" />
                            </motion.div>
                            <span className="font-bold text-2xl text-zinc-900 dark:text-white tracking-tight group-hover:text-[#0B3C3D] dark:group-hover:text-emerald-400 transition-colors">{siteConfig.name}</span>
                        </Link>

                        {!showMfa ? (
                            <>
                                <motion.h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Welcome back</motion.h1>
                                <motion.p className="text-zinc-500">Sign in to continue your journey</motion.p>
                            </>
                        ) : (
                            <>
                                <motion.h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Security Check</motion.h1>
                                <motion.p className="text-zinc-500">Enter code from Google Authenticator</motion.p>
                            </>
                        )}
                    </motion.div>

                    {/* MFA FORM */}
                    {showMfa ? (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <div className="flex justify-center">
                                <Input
                                    placeholder="000 000"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                    maxLength={6}
                                    className="text-center text-3xl tracking-[0.5em] font-mono h-16 w-60 border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl transition-all"
                                    autoFocus
                                />
                            </div>

                            {error && <p className="text-sm text-red-500 text-center font-medium bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">{error}</p>}

                            <Button
                                onClick={handleMfaVerify}
                                disabled={isLoading || mfaCode.length !== 6}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#0B3C3D] to-[#134e4f] hover:from-[#092f30] hover:to-[#0f3d3e] text-white font-bold text-base shadow-lg shadow-[#0B3C3D]/30 transition-all"
                            >
                                {isLoading ? <Activity className="animate-spin h-5 w-5" /> : "Verify Access"}
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => setShowMfa(false)}
                                className="w-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            >
                                Back to Login
                            </Button>
                        </motion.div>
                    ) : (
                        /* LOGIN FORM */
                        <motion.form
                            onSubmit={handleSubmit}
                            noValidate
                            className="space-y-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            {/* Email */}
                            <motion.div className="space-y-2" whileFocus={{ scale: 1.02 }}>
                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-400">Email address</label>
                                <Input
                                    type="email"
                                    placeholder="name@company.com"
                                    className="h-11 px-4 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-base"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={isLoading}
                                />
                            </motion.div>

                            {/* Password */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-400">Password</label>
                                    <Link href="/forgot-password" className="text-sm text-[#0B3C3D] dark:text-emerald-400 hover:text-[#092f30] dark:hover:text-emerald-300 transition-colors font-medium">
                                        Forgot?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••••"
                                        className="h-11 px-4 pr-12 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-base"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                            {/* Submit Button */}
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-12 rounded-xl bg-gradient-to-r from-[#0B3C3D] to-[#134e4f] hover:from-[#092f30] hover:to-[#0f3d3e] text-white font-bold text-base shadow-lg shadow-[#0B3C3D]/30 transition-all group"
                                >
                                    {isLoading ? <Activity className="animate-spin h-5 w-5" /> : (
                                        <>
                                            Sign In
                                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        </motion.form>
                    )}

                    {/* Divider & Social - Only show on Login Step */}
                    {!showMfa && (
                        <>
                            <motion.div
                                className="flex items-center gap-4 my-6"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                <div className="flex-1 h-px bg-zinc-200 dark:bg-white/10" />
                                <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">or</span>
                                <div className="flex-1 h-px bg-zinc-200 dark:bg-white/10" />
                            </motion.div>

                            {/* Features / Links */}
                            <motion.p
                                className="text-center text-sm text-zinc-500 mt-8"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                            >
                                New to {siteConfig.name}?{" "}
                                <Link href="/register" className="text-[#0B3C3D] dark:text-emerald-400 hover:text-[#092f30] dark:hover:text-emerald-300 font-semibold transition-colors">
                                    Create an account
                                </Link>
                            </motion.p>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </div>
    )
}
