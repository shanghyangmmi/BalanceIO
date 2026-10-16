"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { MfaSetup } from "@/components/auth/mfa-setup";
import { apiClient } from "@/lib/api-client";

export default function SecurityPage() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);

    useEffect(() => {
        setLoading(true);
        apiClient.get<any>("/users/me")
            .then(data => {
                setIsEnabled(data.twoFactorEnabled);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h3 className="text-lg font-medium">Security Settings</h3>
                <p className="text-sm text-muted-foreground">Manage your account security preferences.</p>
            </div>
            <div className="h-[1px] bg-zinc-200 dark:bg-zinc-800" />

            <Card className={isEnabled ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10" : ""}>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        {isEnabled ? (
                            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                        ) : (
                            <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                <ShieldAlert className="h-6 w-6" />
                            </div>
                        )}
                        <div>
                            <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
                            <CardDescription>
                                {isEnabled
                                    ? "Your account is protected with Google Authenticator."
                                    : "Add an extra layer of security to your account."}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isEnabled ? (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                                Status: Active & Secure
                            </p>
                            {/* Disable button could go here */}
                        </div>
                    ) : (
                        !showSetup ? (
                            <Button onClick={() => setShowSetup(true)}>
                                Enable 2FA
                            </Button>
                        ) : (
                            <MfaSetup token={token} onComplete={() => {
                                setIsEnabled(true);
                                setShowSetup(false);
                            }} />
                        )
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>Change your password periodically.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline">Change Password</Button>
                </CardContent>
            </Card>
        </div>
    );
}
