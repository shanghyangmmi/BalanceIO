"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { AuthShell, AuthField, AuthError, AuthNotice, authInputClass } from "@/components/auth/auth-shell"

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
// Min 8 chars, upper, lower, digit and symbol: the rule the API enforces.
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

const linkClass =
    "font-medium text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"

export default function RegisterPage() {
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // One name field: many Indonesians have a single name, and a required
    // "last name" turns them away at the door.
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [error, setError] = useState("")

    const validate = (): string | null => {
        if (!name.trim()) return "Enter your name as it should appear on approvals."
        if (!EMAIL_RE.test(email)) return "Enter a valid email address."
        if (!PASSWORD_RE.test(password))
            return "The password needs at least 8 characters, with an uppercase letter, a lowercase letter, a number and one of @$!%*?&."
        if (password !== confirmPassword) return "The two passwords do not match."
        if (!termsAccepted) return "Accept the Terms of Service and Privacy Policy to continue."
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const problem = validate()
        setError(problem ?? "")
        if (problem) return

        setIsLoading(true)
        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), email, password }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "Registration failed.")
            setSuccess(true)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Registration failed."
            setError(
                message === "Failed to fetch"
                    ? "The server did not respond. Check your connection and try again."
                    : message,
            )
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <AuthShell
                eyebrow="Registration received"
                title="Confirm your email"
                footer={
                    <Link href="/login" className={linkClass}>
                        Back to sign in
                    </Link>
                }
            >
                <AuthNotice tone="success">
                    A verification link is on its way to{" "}
                    <span className="font-medium text-foreground">{email}</span>. Open it to activate your
                    account; the company profile comes next. If nothing has arrived in a few minutes,
                    check the spam folder.
                </AuthNotice>
            </AuthShell>
        )
    }

    return (
        <AuthShell
            eyebrow="New account"
            title="Create your account"
            lede="Your account first. The company profile, chart of accounts and team come after you confirm your email."
            footer={
                <>
                    Already registered?{" "}
                    <Link href="/login" className={linkClass}>
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <AuthField label="Full name" htmlFor="name">
                    <Input
                        id="name"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading}
                        className={authInputClass}
                    />
                </AuthField>

                <AuthField label="Work email" htmlFor="email">
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

                <div className="grid gap-5 sm:grid-cols-2">
                    <AuthField label="Password" htmlFor="password">
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
                    <AuthField label="Confirm password" htmlFor="confirm-password">
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
                </div>
                <p className="-mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    At least 8 characters, mixing upper and lower case, a number and a symbol.
                </p>

                <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-muted-foreground">
                    <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(v) => setTermsAccepted(v === true)}
                        className="mt-0.5"
                    />
                    <span>
                        I accept the{" "}
                        <Link href="/terms" className={linkClass}>
                            Terms of Service
                        </Link>{" "}
                        and the{" "}
                        <Link href="/privacy" className={linkClass}>
                            Privacy Policy
                        </Link>
                        .
                    </span>
                </label>

                <AuthError>{error}</AuthError>

                <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-md text-[15px] font-medium">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
            </form>
        </AuthShell>
    )
}
