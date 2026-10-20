"use client"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { AuthShell, AuthField, AuthError, AuthNotice, authInputClass } from "@/components/auth/auth-shell"

const linkClass =
    "font-medium text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"

function ResetPasswordContent() {
    const token = useSearchParams().get("token")

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password.length < 8) {
            setError("The password needs at least 8 characters.")
            return
        }
        if (password !== confirmPassword) {
            setError("The two passwords do not match.")
            return
        }

        setIsLoading(true)
        setError("")
        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "The password could not be reset.")

            setIsSuccess(true)
            setTimeout(() => (window.location.href = "/login"), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "The password could not be reset.")
        } finally {
            setIsLoading(false)
        }
    }

    if (!token) {
        return (
            <AuthShell
                eyebrow="Password reset"
                title="This link is not valid"
                footer={
                    <Link href="/forgot-password" className={linkClass}>
                        Request a new link
                    </Link>
                }
            >
                <AuthNotice tone="error">
                    The reset link is incomplete or has already been used. Links expire one hour after
                    they are sent.
                </AuthNotice>
            </AuthShell>
        )
    }

    if (isSuccess) {
        return (
            <AuthShell
                eyebrow="Password reset"
                title="Password changed"
                footer={
                    <Link href="/login" className={linkClass}>
                        Sign in now
                    </Link>
                }
            >
                <AuthNotice tone="success">
                    Your new password is active, and your other sessions will have to sign in again
                    with it. Taking you to sign in…
                </AuthNotice>
            </AuthShell>
        )
    }

    return (
        <AuthShell
            eyebrow="Password reset"
            title="Choose a new password"
            lede="At least 8 characters. Use one you do not use anywhere else."
            footer={
                <Link href="/login" className={linkClass}>
                    Back to sign in
                </Link>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <AuthField label="New password" htmlFor="password">
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            className={cn(authInputClass, "pr-11")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </AuthField>

                <AuthField label="Confirm new password" htmlFor="confirm-password">
                    <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        className={authInputClass}
                    />
                </AuthField>

                <AuthError>{error}</AuthError>

                <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-md text-[15px] font-medium">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set new password"}
                </Button>
            </form>
        </AuthShell>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <ResetPasswordContent />
        </Suspense>
    )
}
