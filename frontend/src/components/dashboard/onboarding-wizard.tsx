"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { parseJwt } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { usePermission } from "@/contexts/permission-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

type Step = 0 | 1 | 2

const STEPS = ["Company", "Reporting", "Confirm"] as const

const CURRENCIES = [
    {
        code: "IDR",
        name: "Rupiah",
        note: "The default for Indonesian books and tax reporting.",
    },
    {
        code: "USD",
        name: "US dollar",
        note: "Only with prior approval from DJP to keep books in US dollars.",
    },
] as const

export function OnboardingWizard() {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<Step>(0)
    const [companyName, setCompanyName] = useState("")
    const [industry, setIndustry] = useState("")
    const [address, setAddress] = useState("")
    const [city, setCity] = useState("")
    const [currency, setCurrency] = useState<"IDR" | "USD">("IDR")
    const [isLoading, setIsLoading] = useState(false)
    const [nameError, setNameError] = useState(false)

    // Completing setup needs Settings.Manage. Without it the dialog, which cannot
    // be dismissed, would trap Staff and Viewers behind a form the API refuses.
    const { hasPermission, isReady } = usePermission()
    const canCompleteSetup = isReady && hasPermission("Settings.Manage")

    useEffect(() => {
        if (!canCompleteSetup) return

        // Platform administrators have no company to set up.
        const token = localStorage.getItem("token")
        if (token) {
            const user = parseJwt(token)
            const role = user?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || user?.role || ""
            if (role === "Admin" || role === "SuperAdmin") return
        }

        // Through apiClient, not a bare fetch: /company requires a token and
        // the tenant header, and neither is attached by hand here.
        const checkStatus = async () => {
            try {
                const data = await apiClient.get<{ isOnboarded: boolean }>("/company/status")
                if (!data.isOnboarded) setTimeout(() => setOpen(true), 600)
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

    const next = () => {
        if (step === 0 && !companyName.trim()) {
            setNameError(true)
            return
        }
        setStep((s) => Math.min(2, s + 1) as Step)
    }

    const handleComplete = async () => {
        setIsLoading(true)
        try {
            await apiClient.post("/company/onboard", {
                name: companyName.trim(),
                industry: industry.trim() || "General",
                address: address.trim(),
                currency,
                city: city.trim(),
                country: "Indonesia",
            })
            setOpen(false)
            toast.success("Company profile saved", {
                description: "Start with the chart of accounts, or post your opening balances.",
            })
        } catch (error: unknown) {
            // A company that already exists is not a failure - it is the
            // state the wizard was trying to reach. Any other reason has
            // already been surfaced as a toast by apiClient.
            if (error instanceof Error && error.message.includes("already exists")) {
                toast.info("This company is already set up.")
            }
            setOpen(false)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        // Cannot be dismissed: no close button, no escape, no backdrop click.
        <Dialog open={open} onOpenChange={(o) => o && setOpen(o)}>
            <DialogContent
                showCloseButton={false}
                className="gap-0 overflow-hidden rounded-xl border-foreground/10 p-0 sm:max-w-[560px]"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <div className="px-8 pb-6 pt-8">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                        Company setup · {step + 1} of 3
                    </p>
                    <DialogTitle className="font-display mt-4 text-2xl font-bold leading-[1.15] tracking-tight">
                        {step === 0 && "Which company keeps these books?"}
                        {step === 1 && "Choose the reporting currency"}
                        {step === 2 && "Confirm the company profile"}
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                        {step === 0 && "The legal name appears on invoices, faktur pajak and every financial statement."}
                        {step === 1 && "Statements are presented in this currency. It cannot be changed once entries are posted."}
                        {step === 2 && "Everything here can be edited later under Settings, except the currency."}
                    </DialogDescription>

                    {/* Step rule: the drawn-rule gesture, one segment per step. */}
                    <ol className="mt-6 grid grid-cols-3 gap-2">
                        {STEPS.map((label, i) => (
                            <li key={label} className="space-y-2">
                                <div className="h-px overflow-hidden bg-foreground/10">
                                    <div
                                        className={cn(
                                            "h-full origin-left bg-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                            i <= step ? "scale-x-100" : "scale-x-0",
                                        )}
                                    />
                                </div>
                                <span
                                    className={cn(
                                        "font-mono text-[10px] uppercase tracking-[0.18em]",
                                        i <= step ? "text-foreground" : "text-muted-foreground",
                                    )}
                                >
                                    {String(i + 1).padStart(2, "0")} {label}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="border-t border-foreground/10 px-8 py-6">
                    {step === 0 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="ob-name">Legal name</Label>
                                <Input
                                    id="ob-name"
                                    placeholder="PT Contoh Sejahtera"
                                    value={companyName}
                                    autoFocus
                                    aria-invalid={nameError || undefined}
                                    onChange={(e) => {
                                        setCompanyName(e.target.value)
                                        setNameError(false)
                                    }}
                                />
                                {nameError && (
                                    <p className="text-[12px] text-destructive">Enter the company&apos;s legal name.</p>
                                )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ob-industry">Industry</Label>
                                    <Input
                                        id="ob-industry"
                                        placeholder="Distribusi, manufaktur, jasa"
                                        value={industry}
                                        onChange={(e) => setIndustry(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ob-city">City</Label>
                                    <Input
                                        id="ob-city"
                                        placeholder="Surabaya"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ob-address">Registered address</Label>
                                <Input
                                    id="ob-address"
                                    placeholder="Jl. Jenderal Sudirman Kav. 1"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div role="radiogroup" aria-label="Reporting currency" className="grid gap-3">
                            {CURRENCIES.map((c) => {
                                const selected = currency === c.code
                                return (
                                    <button
                                        key={c.code}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => setCurrency(c.code)}
                                        className={cn(
                                            "flex items-start gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors",
                                            selected
                                                ? "border-foreground/40 bg-foreground/[0.03]"
                                                : "border-foreground/10 hover:border-foreground/25",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                                                selected ? "border-foreground" : "border-foreground/30",
                                            )}
                                        >
                                            {selected && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                                        </span>
                                        <span>
                                            <span className="text-sm font-medium text-foreground">
                                                <span className="font-mono">{c.code}</span> · {c.name}
                                            </span>
                                            <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                                                {c.note}
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {step === 2 && (
                        <dl className="divide-y divide-foreground/[0.06] text-sm">
                            {[
                                ["Legal name", companyName.trim()],
                                ["Industry", industry.trim() || "—"],
                                ["Address", [address.trim(), city.trim()].filter(Boolean).join(", ") || "—"],
                                ["Reporting currency", currency],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-6 py-2.5">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="text-right font-medium text-foreground">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-foreground/10 bg-muted/30 px-8 py-4">
                    {step > 0 ? (
                        <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s - 1) as Step)} disabled={isLoading}>
                            Back
                        </Button>
                    ) : (
                        <span />
                    )}
                    {step < 2 ? (
                        <Button size="sm" onClick={next} className="min-w-28">
                            Continue
                        </Button>
                    ) : (
                        <Button size="sm" onClick={handleComplete} disabled={isLoading} className="min-w-28">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save and open the books"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
