"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { AuthShell, AuthField, AuthError, authInputClass } from "@/components/auth/auth-shell"

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    // Second factor
    const [showMfa, setShowMfa] = useState(false)
    const [tempToken, setTempToken] = useState("")
    const [mfaCode, setMfaCode] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!EMAIL_RE.test(email)) {
            setError("Enter the email address you registered with.")
            return
        }
        if (!password) {
            setError("Enter your password.")
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()

            if (res.status === 202 && data.requiresMFA) {
                setTempToken(data.tempToken)
                setShowMfa(true)
                setIsLoading(false)
                return
            }
            if (!res.ok) throw new Error(data.message || "Sign-in failed.")

            localStorage.setItem("token", data.token)
            window.location.href = "/dashboard"
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Sign-in failed."
            setError(
                message === "Failed to fetch"
                    ? "The server did not respond. Check your connection and try again."
                    : message,
            )
            setIsLoading(false)
        }
    }

    const handleMfaVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")
        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/mfa/verify`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tempToken}`,
                },
                body: JSON.stringify({ code: mfaCode }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "That code was not accepted.")

            localStorage.setItem("token", data.token)
            window.location.href = "/dashboard"
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "That code was not accepted.")
            setIsLoading(false)
        }
    }

    if (showMfa) {
        return (
            <AuthShell
                eyebrow="Two-step verification"
                title="Enter your code"
                lede="Open your authenticator app and enter the six-digit code for BalanceIO."
                footer={
                    <button
                        type="button"
                        onClick={() => {
                            setShowMfa(false)
                            setMfaCode("")
                            setError("")
                        }}
                        className="font-medium text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"
                    >
                        Use a different account
                    </button>
                }
            >
                <form onSubmit={handleMfaVerify} noValidate className="space-y-5">
                    <AuthField label="Authentication code" htmlFor="mfa-code">
                        <Input
                            id="mfa-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                            maxLength={6}
                            autoFocus
                            className={cn(authInputClass, "font-money h-14 text-center text-2xl tracking-[0.5em]")}
                        />
                    </AuthField>

                    <AuthError>{error}</AuthError>

                    <Button
                        type="submit"
                        disabled={isLoading || mfaCode.length !== 6}
                        className="h-11 w-full rounded-md text-[15px] font-medium"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify and continue"}
                    </Button>
                </form>
            </AuthShell>
        )
    }

    return (
        <AuthShell
            eyebrow="Workspace access"
            title="Sign in to your books"
            lede="Use the email address your company workspace was set up with."
            footer={
                <>
                    No account yet?{" "}
                    <Link
                        href="/register"
                        className="font-medium text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"
                    >
                        Create an account
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <AuthField label="Email" htmlFor="email">
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="nama@perusahaan.co.id"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        className={authInputClass}
                    />
                </AuthField>

                <AuthField
                    label="Password"
                    htmlFor="password"
                    aside={
                        <Link
                            href="/forgot-password"
                            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Forgot password
                        </Link>
                    }
                >
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            className={cn(authInputClass, "pr-11")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </AuthField>

                <AuthError>{error}</AuthError>

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-11 w-full rounded-md text-[15px] font-medium"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
            </form>
        </AuthShell>
    )
}
