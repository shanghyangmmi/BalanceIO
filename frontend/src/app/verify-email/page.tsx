"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { siteConfig } from "@/config/site"
import { AuthShell, AuthNotice } from "@/components/auth/auth-shell"

const linkClass =
    "font-medium text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"

function VerifyContent() {
    const token = useSearchParams().get("token")

    const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error")
    const [message, setMessage] = useState(token ? "" : "The verification link is incomplete.")

    useEffect(() => {
        if (!token) return

        // Strict Mode mounts twice; only the live mount may write state.
        let mounted = true
        const verify = async () => {
            try {
                const res = await fetch(
                    `${siteConfig.api.baseUrl}/auth/verify_email?token=${encodeURIComponent(token)}`,
                )
                const data = await res.json()
                if (!mounted) return
                if (res.ok) {
                    setStatus("success")
                    setTimeout(() => (window.location.href = "/login"), 3000)
                } else {
                    setStatus("error")
                    setMessage(data.message || "The link could not be verified.")
                }
            } catch {
                if (!mounted) return
                setStatus("error")
                setMessage("The server did not respond. Check your connection and reload this page.")
            }
        }
        verify()
        return () => {
            mounted = false
        }
    }, [token])

    const footer = (
        <Link href="/login" className={linkClass}>
            Go to sign in
        </Link>
    )

    if (status === "loading") {
        return (
            <AuthShell eyebrow="Email verification" title="Verifying your email">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking the link…
                </div>
            </AuthShell>
        )
    }

    if (status === "success") {
        return (
            <AuthShell eyebrow="Email verification" title="Email confirmed" footer={footer}>
                <AuthNotice tone="success">
                    Your account is active. Taking you to sign in, where the company setup begins.
                </AuthNotice>
            </AuthShell>
        )
    }

    return (
        <AuthShell eyebrow="Email verification" title="This link did not work" footer={footer}>
            <AuthNotice tone="error">{message}</AuthNotice>
        </AuthShell>
    )
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <VerifyContent />
        </Suspense>
    )
}
