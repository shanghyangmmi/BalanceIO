"use client"


import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { parseJwt } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, Building, Wallet, Calendar, Activity, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { siteConfig } from "@/config/site"
import { apiClient } from "@/lib/api-client"
import { usePermission } from "@/contexts/permission-context"

export function OnboardingWizard() {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState("company")
    const [companyName, setCompanyName] = useState("")
    const [industry, setIndustry] = useState("")
    const [address, setAddress] = useState("")
    const [currency, setCurrency] = useState("IDR")
    const [isLoading, setIsLoading] = useState(false)
    // Completing setup needs Settings.Manage. Without it the dialog, which cannot
    // be dismissed, would trap Staff and Viewers behind a form the API refuses.
    const { hasPermission, isLoading: permissionsLoading } = usePermission()
    const canCompleteSetup = !permissionsLoading && hasPermission("Settings.Manage")

    useEffect(() => {
        if (!canCompleteSetup) return;

        // SKIP FOR ADMINS
        const token = localStorage.getItem("token")
        if (token) {
            const user = parseJwt(token)
            const role = user?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || user?.role || ""
            if (role === "Admin" || role === "SuperAdmin") return;
        }

        // Check onboarding status from API.
        //
        // Through apiClient, not a bare fetch: /company requires a token and
        // the tenant header, and neither is attached by hand here.
        const checkStatus = async () => {
            try {
                const data = await apiClient.get<{ isOnboarded: boolean }>("/company/status")
                if (!data.isOnboarded) {
                    // Delay slightly for better UX
                    setTimeout(() => setOpen(true), 1000)
                }
            } catch {
                // A failed check is not evidence that setup is missing. This
                // dialog cannot be dismissed once it opens - no close button,
                // no escape, no backdrop - so opening it on a network blip or
                // an expired session traps the user behind a modal over a
                // workspace that is already set up. Say nothing instead.
            }
        }
        checkStatus()
    }, [canCompleteSetup])

    // Prevent closing dialog without completing - no X button, no escape, no backdrop click
    const handleOpenChange = (newOpen: boolean) => {
        // Only allow closing if completing the wizard (not by clicking outside or pressing escape)
        // This is intentionally restrictive - user must complete setup
        if (!newOpen) {
            // Don't allow closing
            return
        }
        setOpen(newOpen)
    }

    const handleComplete = async () => {
        setIsLoading(true)

        try {
            await apiClient.post("/company/onboard", {
                name: companyName || "My Company",
                industry: industry || "General",
                address: address, // Send the address
                currency: currency,
                city: "Jakarta",
                country: "Indonesia",
            })

            setOpen(false)
            toast.success(`Welcome to ${siteConfig.name}!`, {
                description: "Your workspace is ready. You can start managing your finances."
            })
        } catch (error: any) {
            // A company that already exists is not a failure - it is the
            // state the wizard was trying to reach.
            if (error?.message?.includes("already exists")) {
                setOpen(false)
                toast.info("Company profile loaded", { description: "Your company is already set up." })
            } else {
                // apiClient has already surfaced the reason as a toast.
                setOpen(false)
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {/* hideCloseButton removes the X button, modal prevents backdrop click close */}
            <DialogContent
                className="sm:max-w-[600px] p-0 overflow-hidden"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <div className="bg-zinc-950 p-6 text-white h-full flex flex-col justify-between" style={{ backgroundImage: 'linear-gradient(to bottom right, #09090b, #18181b)' }}>
                    <div>
                        <div className="h-10 w-10 rounded-lg overflow-hidden mb-4 shadow-lg shadow-[#0B3C3D]/40">
                            <img src="/images/logo-icon.svg" alt={siteConfig.name} className="h-full w-full object-cover" />
                        </div>
                        <DialogTitle className="text-2xl font-bold mb-2">Welcome to {siteConfig.name}</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Let's get your professional accounting workspace set up in just a few steps.
                        </DialogDescription>
                    </div>
                </div>

                <div className="p-6">
                    <Tabs value={step} onValueChange={setStep} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="company" disabled={step !== 'company'}>1. Company</TabsTrigger>
                            <TabsTrigger value="preferences" disabled={step === 'company'}>2. Preferences</TabsTrigger>
                            <TabsTrigger value="finish" disabled={step !== 'finish'}>3. Finish</TabsTrigger>
                        </TabsList>

                        <TabsContent value="company" className="space-y-4">
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input
                                    placeholder="Acme Corp, Inc."
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Input
                                    placeholder="123 Business St, Jakarta"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Industry</Label>
                                <Input
                                    placeholder="e.g. Retail, Technology, Consulting"
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={() => setStep("preferences")}>
                                    Next: Preferences
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="preferences" className="space-y-4">
                            <div className="space-y-2">
                                <Label>Reporting Currency</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setCurrency("IDR")}
                                        className={`border rounded-md p-4 flex items-center gap-2 cursor-pointer transition-all ${currency === "IDR"
                                            ? "border-[#0B3C3D] bg-emerald-50/50 dark:bg-emerald-900/10 ring-2 ring-[#0B3C3D]/20"
                                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                                            }`}
                                    >
                                        <Wallet className={`h-5 w-5 ${currency === "IDR" ? "text-[#0B3C3D] dark:text-emerald-400" : "text-zinc-400"}`} />
                                        <span className="font-medium">IDR (Rupiah)</span>
                                    </div>
                                    <div
                                        onClick={() => setCurrency("USD")}
                                        className={`border rounded-md p-4 flex items-center gap-2 cursor-pointer transition-all ${currency === "USD"
                                            ? "border-[#0B3C3D] bg-emerald-50/50 dark:bg-emerald-900/10 ring-2 ring-[#0B3C3D]/20"
                                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                                            }`}
                                    >
                                        <Wallet className={`h-5 w-5 ${currency === "USD" ? "text-[#0B3C3D] dark:text-emerald-400" : "text-zinc-400"}`} />
                                        <span className="font-medium">USD (Dollar)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button variant="ghost" onClick={() => setStep("company")}>Back</Button>
                                <Button onClick={() => setStep("finish")}>Next: Finish</Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="finish" className="text-center py-6 space-y-4">
                            <div className="flex justify-center mb-4">
                                <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                    <CheckCircle className="h-8 w-8 text-[#0B3C3D] dark:text-emerald-400" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold">You're All Set!</h3>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                                We've configured your Chart of Accounts and basic settings for your business.
                            </p>
                            <div className="flex justify-center pt-4">
                                <Button className="w-full max-w-xs" onClick={handleComplete} disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Setting up...
                                        </>
                                    ) : (
                                        "Go to Dashboard"
                                    )}
                                </Button>
                            </div>
                        </TabsContent>

                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}
