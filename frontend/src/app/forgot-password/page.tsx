"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteConfig } from "@/config/site"
import { AuthShell, AuthField, AuthError, AuthNotice, authInputClass } from "@/components/auth/auth-shell"

const linkClass =
    "font-medium text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"

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
                body: JSON.stringify({ email }),
            })
            // The same answer whether or not the address exists, so the form
            // cannot be used to discover accounts. Only a server fault differs.
            if (!res.ok && res.status >= 500) {
                throw new Error("The server could not take the request. Try again shortly.")
            }
            setIsSubmitted(true)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : ""
            setError(
                message === "Failed to fetch" || !message
                    ? "The server did not respond. Check your connection and try again."
                    : message,
            )
        } finally {
            setIsLoading(false)
        }
    }

    const footer = (
        <>
            Remembered it?{" "}
            <Link href="/login" className={linkClass}>
                Back to sign in
            </Link>
        </>
    )

    if (isSubmitted) {
        return (
            <AuthShell eyebrow="Password reset" title="Check your inbox" footer={footer}>
                <AuthNotice tone="success">
                    If an account is registered to <span className="font-medium text-foreground">{email}</span>,
                    a reset link is on its way. It expires in one hour.
                </AuthNotice>
            </AuthShell>
        )
    }

    return (
        <AuthShell
            eyebrow="Password reset"
            title="Reset your password"
            lede="Enter the email you sign in with. We will send a link to choose a new password."
            footer={footer}
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
                        required
                        className={authInputClass}
                    />
                </AuthField>

                <AuthError>{error}</AuthError>

                <Button
                    type="submit"
                    disabled={isLoading || !email}
                    className="h-11 w-full rounded-md text-[15px] font-medium"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                </Button>
            </form>
        </AuthShell>
    )
}
