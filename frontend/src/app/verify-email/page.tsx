"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { BackgroundPattern } from "@/components/ui/background-pattern";
import { motion } from "framer-motion";

import { Suspense } from "react";

function VerifyContent() {

    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Verifying your email...");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Invalid verification link.");
            return;
        }

        // Prevent double-firing in React Strict Mode
        let mounted = true;

        const verify = async () => {
            try {
                const res = await fetch(`${siteConfig.api.baseUrl}/auth/verify_email?token=${token}`);
                const data = await res.json();

                if (mounted) {
                    if (res.ok) {
                        setStatus("success");
                        setMessage("Email verified successfully! Redirecting to login...");
                        setTimeout(() => window.location.href = "/login", 3000); // Auto-redirect after 3s
                    } else {
                        setStatus("error");
                        setMessage(data.message || "Failed to verify email.");
                    }
                }
            } catch (error) {
                if (mounted) {
                    setStatus("error");
                    setMessage("An error occurred. Please try again.");
                }
            }
        };

        verify();

        return () => { mounted = false; };
    }, [token]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center relative overflow-hidden">
            <BackgroundPattern />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-md p-8 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl text-center"
            >
                <div className="flex justify-center mb-6">
                    {status === "loading" && <Loader2 className="h-16 w-16 text-emerald-500 animate-spin" />}
                    {status === "success" && <CheckCircle2 className="h-16 w-16 text-emerald-500" />}
                    {status === "error" && <XCircle className="h-16 w-16 text-red-500" />}
                </div>

                <h1 className="text-2xl font-bold mb-2">
                    {status === "loading" ? "Verifying..." : status === "success" ? "Verified!" : "Verification Failed"}
                </h1>

                <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                    {message}
                </p>

                {status !== "loading" && (
                    <Button onClick={() => window.location.href = "/login"} className="w-full bg-[#0B3C3D] hover:bg-[#092f30] text-white">
                        Go to Login
                    </Button>
                )}
            </motion.div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        }>
            <VerifyContent />
        </Suspense>
    );
}
