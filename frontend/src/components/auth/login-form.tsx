"use client";

import { useState } from "react"
// import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { MfaVerify } from "./mfa-verify"
import { siteConfig } from "@/config/site"

export function LoginForm() {
    // const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    // MFA State
    const [showMfa, setShowMfa] = useState(false)
    const [tempToken, setTempToken] = useState("")

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            })

            const data = await res.json()

            if (res.status === 202 && data.requiresMFA) {
                // Determine if we need to show MFA screen
                setTempToken(data.tempToken)
                setShowMfa(true)
                setIsLoading(false)
                return
            }

            if (!res.ok) {
                throw new Error(data.message || "Failed to login")
            }

            // Success (No MFA or already handled?)
            // Store token? For now just redirect
            // Ideally store in localStorage or cookie
            localStorage.setItem("token", data.token)
            window.location.href = "/dashboard"

        } catch (err: any) {
            setError(err.message)
            setIsLoading(false)
        }
    }

    const handleMfaSuccess = (token: string) => {
        localStorage.setItem("token", token)
        window.location.href = "/dashboard"
    }

    if (showMfa) {
        return (
            <MfaVerify
                tempToken={tempToken}
                onSuccess={handleMfaSuccess}
                onCancel={() => setShowMfa(false)}
            />
        )
    }

    return (
        <div className="grid gap-6 w-full max-w-sm mx-auto">
            <form onSubmit={onSubmit}>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            placeholder="name@example.com"
                            type="email"
                            autoCapitalize="none"
                            autoComplete="email"
                            autoCorrect="off"
                            disabled={isLoading}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            disabled={isLoading}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                    <Button disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sign In
                    </Button>
                </div>
            </form>
        </div>
    )
}
