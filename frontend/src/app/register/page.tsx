"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { Eye, EyeOff, ArrowRight, Check, Activity, Lock, Mail, User, Building2 } from "lucide-react"
import { useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"

import { BackgroundPattern } from "@/components/ui/background-pattern"
import { Spotlight } from "@/components/ui/spotlight"

export default function RegisterPage() {

    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Form State
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [companyName, setCompanyName] = useState("")
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [error, setError] = useState("")

    const validateEmail = (email: string) => {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    };

    const validateName = (name: string) => {
        const re = /^[A-Za-z\s]+$/;
        return re.test(name);
    };

    const validatePassword = (password: string) => {
        // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
        const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return re.test(password);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        // 1. Mandatory Fields & Name Validation
        if (!firstName.trim() || !lastName.trim()) {
            setError("First Name and Last Name are required.");
            setIsLoading(false);
            return;
        }

        if (!validateName(firstName) || !validateName(lastName)) {
            setError("Names must contain letters only.");
            setIsLoading(false);
            return;
        }

        // 2. Email Validation
        if (!validateEmail(email)) {
            setError("Please enter a valid email address.");
            setIsLoading(false);
            return;
        }

        // 3. Company Name
        if (!companyName.trim()) {
            setError("Company Name is required.");
            setIsLoading(false);
            return;
        }

        // 4. Strong Password Validation
        if (!validatePassword(password)) {
            setError("Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a symbol.");
            setIsLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setIsLoading(false);
            return;
        }

        // 4. Terms Acceptance
        if (!termsAccepted) {
            setError("You must agree to the Terms of Service and Privacy Policy.");
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `${firstName} ${lastName}`,
                    email,
                    password,
                    companyName
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || "Failed to register")
            }

            // Success -> Show verification message
            setSuccess(true)

        } catch (err: any) {
            // Handle network errors gracefully
            if (err.message === "Failed to fetch" || err.name === "TypeError" && err.message.includes("fetch")) {
                setError("Unable to connect to the server. Please check your internet connection.");
            } else {
                setError(err.message)
            }
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                <BackgroundPattern />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 w-full max-w-md p-8 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl text-center"
                >
                    <div className="flex justify-center mb-6">
                        <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-white">Check your email</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-8 text-lg">
                        We've sent a verification link to <br /><span className="font-semibold text-emerald-600 dark:text-emerald-400">{email}</span>
                    </p>
                    <div className="space-y-4">
                        <Link href="/login" className="block">
                            <Button className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg hover:shadow-emerald-500/25 transition-all">
                                Return to Login
                            </Button>
                        </Link>
                        <p className="text-sm text-zinc-500">
                            Didn't receive it? Check your spam folder.
                        </p>
                    </div>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center relative overflow-hidden py-4 px-4 text-sm">
            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>

            {/* Shared Background from Landing Page */}
            <BackgroundPattern />

            {/* Spotlight for Drama */}
            <Spotlight className="-top-40 left-0 text-emerald-500/20 dark:text-emerald-400/20" />

            {/* Main Container */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
                className="relative z-10 w-full max-w-[400px]"
            >
                {/* Card */}
                <motion.div
                    className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-3xl p-6 shadow-xl ring-1 ring-black/5 dark:ring-white/5"
                    whileHover={{ boxShadow: "0 20px 40px -12px rgba(11, 60, 61, 0.15)", borderColor: "rgba(11, 60, 61, 0.3)" }}
                    transition={{ duration: 0.3 }}
                >

                    {/* Header */}
                    <div className="text-center mb-5">
                        <Link href="/" className="inline-flex items-center gap-2 mb-3 group">
                            <motion.div
                                className="h-9 w-9 rounded-xl overflow-hidden shadow-lg shadow-[#0B3C3D]/20 ring-1 ring-white/20"
                                whileHover={{ scale: 1.1, rotate: -5 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                <img src="/images/logo-icon.svg" alt={siteConfig.name} className="h-full w-full object-cover" />
                            </motion.div>
                            <span className="font-bold text-xl text-zinc-900 dark:text-white tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{siteConfig.name}</span>
                        </Link>
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-1 tracking-tight">Create your account</h1>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Join thousands of companies managing finances better.</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} noValidate className="space-y-3">

                        {/* Name Row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">First Name <span className="text-red-500">*</span></label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <Input
                                        type="text"
                                        placeholder="Balance"
                                        className="h-10 pl-9 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-sm"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Last Name <span className="text-red-500">*</span></label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <Input
                                        type="text"
                                        placeholder="IO"
                                        className="h-10 pl-9 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-sm"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Work Email <span className="text-red-500">*</span></label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    type="email"
                                    placeholder="balanceio@company.com"
                                    className="h-10 pl-9 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </div>

                        {/* Company */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Company Name <span className="text-red-500">*</span></label>
                            <div className="relative group">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    type="text"
                                    placeholder="BalanceIO"
                                    className="h-10 pl-9 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-sm"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Password <span className="text-red-500">*</span></label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    className="h-10 pl-9 pr-9 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-sm"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">Confirm Password <span className="text-red-500">*</span></label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    className="h-10 pl-9 pr-9 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm shadow-sm"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                            >
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">{error}</p>
                            </motion.div>
                        )}

                        {/* Terms */}
                        <div className="flex items-start gap-2 py-1">
                            <div className="relative flex items-center pt-0.5">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 checked:border-emerald-500 checked:bg-emerald-500 transition-all"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    required
                                />
                                <Check className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                            </div>
                            <label htmlFor="terms" className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                                I agree to the <Link href="/terms" className="text-zinc-900 dark:text-white hover:text-emerald-500 font-semibold underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 transition-colors">Terms of Service</Link> and <Link href="/privacy" className="text-zinc-900 dark:text-white hover:text-emerald-500 font-semibold underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 transition-colors">Privacy Policy</Link>. <span className="text-red-500">*</span>
                            </label>
                        </div>

                        {/* Submit */}
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-1">
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#0B3C3D] to-[#134e4f] hover:from-[#092f30] hover:to-[#0f3d3e] text-white font-bold text-base shadow-lg shadow-[#0B3C3D]/20 group relative overflow-hidden"
                            >
                                {/* Shine effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                                {isLoading ? <Activity className="animate-spin h-5 w-5" /> : (
                                    <div className="flex items-center gap-2">
                                        Create Account
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                )}
                            </Button>
                        </motion.div>
                    </form>

                    {/* Sign In Link */}
                    <div className="text-center mt-6 pt-4 border-t border-zinc-200 dark:border-white/10">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Already have an account?{" "}
                            <Link href="/login" className="text-[#0B3C3D] dark:text-emerald-400 hover:text-[#092f30] dark:hover:text-emerald-300 font-bold transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </motion.div>

                {/* Secure Badge */}
                <div className="mt-6 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/5 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
                        <Lock className="h-3 w-3" />
                        Secure Encrypted
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
