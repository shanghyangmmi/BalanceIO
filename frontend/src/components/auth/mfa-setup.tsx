import { useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, ShieldCheck, Copy, CheckCircle } from "lucide-react"

// Mock API calls - replace with real fetch
import { apiClient } from "@/lib/api-client"

// REAL API calls using apiClient
async function setupMfaApi() {
    return apiClient.post<any>("/auth/mfa/setup", {})
}

async function enableMfaApi(code: string) {
    return apiClient.post<any>("/auth/mfa/enable", { code })
}

export function MfaSetup({ token, onComplete }: { token: string, onComplete: () => void }) {
    const [step, setStep] = useState<"init" | "qr" | "success">("init")
    const [secret, setSecret] = useState("")
    const [qrUri, setQrUri] = useState("")
    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleStart = async () => {
        setLoading(true)
        try {
            const data = await setupMfaApi()
            setSecret(data.secret)
            setQrUri(data.qrCodeUri)
            setStep("qr")
        } catch (e) {
            setError("Failed to start MFA setup")
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async () => {
        setLoading(true)
        setError("")
        try {
            await enableMfaApi(code)
            setStep("success")
            setTimeout(() => onComplete(), 2000)
        } catch (e) {
            setError("Invalid OTP Code. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    if (step === "init") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        two-Factor Authentication
                    </CardTitle>
                    <CardDescription>
                        Secure your account with Google Authenticator.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Protect your account by requiring a code from your mobile phone in addition to your password.
                    </p>
                    {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleStart} disabled={loading} className="w-full">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enable 2FA"}
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    if (step === "qr") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Scan QR Code</CardTitle>
                    <CardDescription>Open Google Authenticator and scan this code.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex justify-center p-4 bg-white rounded-xl border">
                        <QRCodeCanvas value={qrUri} size={200} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Manual Entry Key</label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-xs">
                            <span className="truncate flex-1">{secret}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(secret)}>
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Verify Code</label>
                        <Input
                            placeholder="000000"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            maxLength={6}
                            className="text-center text-lg tracking-widest"
                        />
                    </div>

                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep("init")} className="flex-1">Cancel</Button>
                    <Button onClick={handleVerify} disabled={code.length !== 6 || loading} className="flex-1">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Activate"}
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10">
            <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100">2FA Enabled!</h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">Your account is now Super Safe.</p>
                </div>
            </CardContent>
        </Card>
    )
}
