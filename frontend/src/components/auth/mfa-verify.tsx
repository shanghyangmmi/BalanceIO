import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield } from "lucide-react"

import { apiClient } from "@/lib/api-client"

async function verifyMfaApi(code: string) {
    return apiClient.post<any>("/auth/mfa/verify", { code })
}

export function MfaVerify({ tempToken, onSuccess, onCancel }: { tempToken: string, onSuccess: (token: string) => void, onCancel: () => void }) {
    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleVerify = async () => {
        setLoading(true)
        setError("")
        try {
            // Note: tempToken is used during login challenge. 
            // We need to pass it as Authorization header manually because localStorage might not have it yet.
            const data = await apiClient.post<any>("/auth/mfa/verify", { code }, {
                headers: { "Authorization": `Bearer ${tempToken}` }
            })
            onSuccess(data.token) // Real token
        } catch (e) {
            setError("Invalid Authentication Code")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto shadow-2xl border-emerald-500/20">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>Two-Factor Check</CardTitle>
                <CardDescription>Enter the code from your Authenticator app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-center">
                    <Input
                        placeholder="000 000"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        maxLength={6}
                        className="text-center text-2xl tracking-[0.5em] font-mono h-14 w-48 border-emerald-200 focus:border-emerald-500 ring-emerald-500/20"
                        autoFocus
                    />
                </div>
                {error && <Alert variant="destructive" className="text-center py-2"><AlertDescription>{error}</AlertDescription></Alert>}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
                <Button onClick={handleVerify} disabled={code.length !== 6 || loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Access"}
                </Button>
                <Button variant="ghost" onClick={onCancel} className="w-full text-sm text-muted-foreground">
                    Back to Login
                </Button>
            </CardFooter>
        </Card>
    )
}
