"use client";

import { useState } from "react";
import { Shield, Lock, AlertTriangle, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { siteConfig } from "@/config/site";
import { parseJwt } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle"; // Assuming this component exists from login page analysis

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showMfa, setShowMfa] = useState(false);
    const [tempToken, setTempToken] = useState("");
    const [mfaCode, setMfaCode] = useState("");

    const validateEmail = (email: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!validateEmail(email)) {
            setError("Invalid email format");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/admin/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.status === 202 && data.requiresMFA) {
                setTempToken(data.tempToken);
                setShowMfa(true);
                setLoading(false);
                return;
            }

            if (!res.ok) throw new Error(data.message || "Invalid credentials");
            finalizeLogin(data.token);
        } catch (err: any) {
            setError(err.message || "Authentication failed");
            setLoading(false);
        }
    };

    const handleMfaVerify = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${siteConfig.api.baseUrl}/auth/mfa/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${tempToken}`
                },
                body: JSON.stringify({ code: mfaCode })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Invalid Code");
            finalizeLogin(data.token);
        } catch (err: any) {
            setError(err.message || "Verification failed");
            setLoading(false);
        }
    };

    const finalizeLogin = (token: string) => {
        localStorage.setItem("adminToken", token);
        window.location.href = "/sys-control/dashboard";
    };

    return (
        <div className="min-h-screen grid items-center justify-center bg-zinc-950 text-white relative overflow-hidden">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-red-900/20 blur-[120px] rounded-full mix-blend-screen opacity-50 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-full h-[500px] bg-indigo-900/10 blur-[120px] rounded-full mix-blend-screen opacity-50 pointer-events-none" />
            </div>

            <Card className="z-10 w-full max-w-[420px] bg-zinc-900/80 border-zinc-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-3 pb-6 border-b border-zinc-800/50">
                    <div className="flex justify-center">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/50 ring-4 ring-zinc-900">
                            <Shield className="h-7 w-7 text-white" />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <CardTitle className="text-2xl font-bold tracking-tight text-white">
                            System Control
                        </CardTitle>
                        <CardDescription className="text-zinc-400">
                            Authorized personnel only
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-4">
                    {!showMfa ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-950/50 border-red-900/50 text-red-200">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Email Identity</label>
                                <div className="relative">
                                    <Input
                                        type="email"
                                        placeholder="Email Address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-red-600/50 focus:ring-red-600/20 transition-all pl-10"
                                        disabled={loading}
                                        autoComplete="off"
                                    />
                                    <div className="absolute left-3 top-2.5 text-zinc-600">
                                        <Fingerprint className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Security Key</label>
                                <div className="relative">
                                    <Input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-zinc-950/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-red-600/50 focus:ring-red-600/20 transition-all pl-10"
                                        disabled={loading}
                                        autoComplete="off"
                                    />
                                    <div className="absolute left-3 top-2.5 text-zinc-600">
                                        <Lock className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-red-700 hover:bg-red-600 text-white font-medium shadow-lg shadow-red-900/20 transition-all h-10"
                                disabled={loading}
                            >
                                {loading ? "Verifying Credentials..." : "Access System"}
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="text-center space-y-2">
                                <p className="text-zinc-300 font-medium">Verify Identity</p>
                                <p className="text-xs text-zinc-500">Enter the 6-digit code from your authenticator app</p>
                            </div>

                            <div className="flex justify-center py-2">
                                <Input
                                    type="text"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="text-center text-3xl font-mono tracking-[0.5em] w-48 h-12 bg-zinc-950 border-zinc-800 focus:border-red-500/50 focus:ring-red-500/20"
                                    autoFocus
                                    placeholder="000000"
                                />
                            </div>

                            {error && (
                                <p className="text-xs text-red-400 text-center">{error}</p>
                            )}

                            <Button
                                onClick={handleMfaVerify}
                                className="w-full bg-red-700 hover:bg-red-600"
                                disabled={loading || mfaCode.length !== 6}
                            >
                                {loading ? "Verifying..." : "Confirm"}
                            </Button>
                            <Button variant="ghost" className="w-full text-zinc-500 hover:text-white" onClick={() => setShowMfa(false)}>
                                Back to Login
                            </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center border-t border-zinc-800/50 py-4">
                    <p className="text-[10px] text-zinc-600 flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500/50"></span>
                        </span>
                        System usage is monitored for security purposes.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
