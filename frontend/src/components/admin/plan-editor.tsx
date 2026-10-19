"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

export interface AdminPlanRow {
    id: string
    name: string
    description: string | null
    priceMonthly: number
    priceYearly: number
    promoPriceMonthly: number | null
    promoEndsAt: string | null
    maxUsers: number
    maxCompanies: number
    maxStorageMB: number
    maxJournalEntries: number
    features: string | null // JSON array of display highlights
    modules: string | null // JSON array of module keys
    isActive: boolean
    isPopular: boolean
}

const MODULES = [
    { key: "accounting", label: "Accounting", locked: true },
    { key: "tax", label: "Tax" },
    { key: "inventory", label: "Inventory" },
    { key: "fixedAssets", label: "Fixed assets" },
    { key: "payroll", label: "Payroll" },
] as const

const rupiah = new Intl.NumberFormat("id-ID")

/** Whole rupiah only. Money is never parsed as a float here. */
function toRupiah(text: string): number {
    const digits = text.replace(/\D/g, "")
    return digits ? Number(digits) : 0
}

function parseList(json: string | null): string[] {
    if (!json) return []
    try {
        const v = JSON.parse(json)
        return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
    } catch {
        return []
    }
}

/** The promotion ends at the close of the chosen day, Jakarta time. */
function endOfDayJakarta(date: string): string {
    return `${date}T23:59:59+07:00`
}

function jakartaDate(iso: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    // en-CA formats as YYYY-MM-DD, which is what <input type="date"> takes.
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
}

function RupiahField({
    id,
    label,
    value,
    onChange,
    hint,
    placeholder,
}: {
    id: string
    label: string
    value: number | null
    onChange: (v: number | null) => void
    hint?: string
    placeholder?: string
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-[12px] text-muted-foreground">
                {label}
            </Label>
            <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                    Rp
                </span>
                <Input
                    id={id}
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={value === null ? "" : rupiah.format(value)}
                    onChange={(e) => onChange(e.target.value.trim() === "" ? null : toRupiah(e.target.value))}
                    className="font-money pl-9"
                />
            </div>
            {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
    )
}

function NumberField({
    id,
    label,
    value,
    onChange,
    hint,
}: {
    id: string
    label: string
    value: number
    onChange: (v: number) => void
    hint?: string
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-[12px] text-muted-foreground">
                {label}
            </Label>
            <Input
                id={id}
                inputMode="numeric"
                value={String(value)}
                onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0))}
                className="font-money"
            />
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    )
}

/**
 * One plan, as the pricing page and checkout will use it.
 *
 * The highlights are the short lines printed on the plan's card. The full
 * feature checklist is not edited here: it is the licensing catalogue
 * (Licensing → feature matrix), because those rows are what the API
 * actually enforces.
 */
export function PlanEditor({
    plan,
    onSave,
}: {
    plan: AdminPlanRow
    onSave: (p: AdminPlanRow) => Promise<boolean>
}) {
    const [edited, setEdited] = useState<AdminPlanRow>(plan)
    const [highlights, setHighlights] = useState(parseList(plan.features).join("\n"))
    const [promoDate, setPromoDate] = useState(jakartaDate(plan.promoEndsAt))
    const [saving, setSaving] = useState(false)

    const modules = useMemo(() => {
        const list = parseList(edited.modules)
        return list.length ? list : ["accounting"]
    }, [edited.modules])

    const dirty =
        JSON.stringify(edited) !== JSON.stringify(plan) ||
        highlights !== parseList(plan.features).join("\n") ||
        promoDate !== jakartaDate(plan.promoEndsAt)

    const set = <K extends keyof AdminPlanRow>(key: K, value: AdminPlanRow[K]) =>
        setEdited((p) => ({ ...p, [key]: value }))

    const toggleModule = (key: string, on: boolean) => {
        const next = on ? Array.from(new Set([...modules, key])) : modules.filter((m) => m !== key)
        set("modules", JSON.stringify(MODULES.map((m) => m.key).filter((k) => next.includes(k))))
    }

    const promoRunning =
        edited.promoPriceMonthly !== null && promoDate !== "" && new Date(endOfDayJakarta(promoDate)) > new Date()

    const save = async () => {
        setSaving(true)
        const lines = highlights
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        const ok = await onSave({
            ...edited,
            features: JSON.stringify(lines),
            promoEndsAt: edited.promoPriceMonthly !== null && promoDate ? endOfDayJakarta(promoDate) : null,
            promoPriceMonthly: promoDate ? edited.promoPriceMonthly : null,
        })
        setSaving(false)
        return ok
    }

    return (
        <section className="rounded-xl border border-foreground/10 bg-card">
            <header className="flex items-start justify-between gap-4 border-b border-foreground/10 px-5 py-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
                        {!edited.isActive && (
                            <span className="rounded-full border border-foreground/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                                Hidden
                            </span>
                        )}
                        {promoRunning && (
                            <span className="rounded-full border border-emerald-600/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                                Promo running
                            </span>
                        )}
                    </div>
                    <Input
                        value={edited.description ?? ""}
                        onChange={(e) => set("description", e.target.value)}
                        placeholder="One-line description shown on the pricing page"
                        className="mt-2 h-8 border-transparent px-0 text-[13px] text-muted-foreground shadow-none focus-visible:border-foreground/20 focus-visible:px-2"
                    />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 text-[12px] text-muted-foreground">
                    <label className="flex items-center gap-2">
                        Shown on pricing
                        <Switch checked={edited.isActive} onCheckedChange={(c) => set("isActive", c)} />
                    </label>
                    <label className="flex items-center gap-2">
                        Recommended
                        <Switch checked={edited.isPopular} onCheckedChange={(c) => set("isPopular", c)} />
                    </label>
                </div>
            </header>

            <div className="grid gap-6 px-5 py-5">
                <fieldset className="grid gap-4 sm:grid-cols-2">
                    <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Price
                    </legend>
                    <RupiahField
                        id={`${plan.id}-monthly`}
                        label="Per month"
                        value={edited.priceMonthly}
                        onChange={(v) => set("priceMonthly", v ?? 0)}
                    />
                    <RupiahField
                        id={`${plan.id}-yearly`}
                        label="Per year"
                        value={edited.priceYearly}
                        onChange={(v) => set("priceYearly", v ?? 0)}
                        hint="Yearly billing is never discounted by the promotion."
                    />
                </fieldset>

                <fieldset className="grid gap-4 sm:grid-cols-2">
                    <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Promotion
                    </legend>
                    <RupiahField
                        id={`${plan.id}-promo`}
                        label="Promotional price per month"
                        value={edited.promoPriceMonthly}
                        onChange={(v) => set("promoPriceMonthly", v)}
                        placeholder="No promotion"
                    />
                    <div className="space-y-1.5">
                        <Label htmlFor={`${plan.id}-promo-end`} className="text-[12px] text-muted-foreground">
                            Last day of the promotion
                        </Label>
                        <Input
                            id={`${plan.id}-promo-end`}
                            type="date"
                            value={promoDate}
                            onChange={(e) => setPromoDate(e.target.value)}
                        />
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                            Ends at 23:59 WIB. Checkouts after that pay the normal price. Clear both fields to stop it.
                        </p>
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Modules this plan opens
                    </legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {MODULES.map((m) => {
                            const locked = "locked" in m && m.locked
                            return (
                                <label
                                    key={m.key}
                                    className={cn(
                                        "flex items-center gap-2 text-[13px]",
                                        locked ? "text-muted-foreground" : "text-foreground",
                                    )}
                                >
                                    <Checkbox
                                        checked={locked || modules.includes(m.key)}
                                        disabled={locked}
                                        onCheckedChange={(c) => toggleModule(m.key, c === true)}
                                    />
                                    {m.label}
                                </label>
                            )
                        })}
                    </div>
                </fieldset>

                <fieldset className="grid gap-4 sm:grid-cols-3">
                    <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Limits
                    </legend>
                    <NumberField id={`${plan.id}-users`} label="Users" value={edited.maxUsers} onChange={(v) => set("maxUsers", v)} />
                    <NumberField
                        id={`${plan.id}-companies`}
                        label="Companies"
                        value={edited.maxCompanies}
                        onChange={(v) => set("maxCompanies", v)}
                    />
                    <NumberField
                        id={`${plan.id}-journals`}
                        label="Journal entries"
                        value={edited.maxJournalEntries}
                        onChange={(v) => set("maxJournalEntries", v)}
                        hint="0 means unlimited."
                    />
                </fieldset>

                <div className="space-y-1.5">
                    <Label htmlFor={`${plan.id}-highlights`} className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Highlights on the pricing card
                    </Label>
                    <Textarea
                        id={`${plan.id}-highlights`}
                        value={highlights}
                        onChange={(e) => setHighlights(e.target.value)}
                        rows={5}
                        className="text-[13px]"
                    />
                    <p className="text-[11px] text-muted-foreground">
                        One line each. The full checklist comes from Licensing, where each feature is switched on per plan.
                    </p>
                </div>
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-foreground/10 px-5 py-3">
                {dirty && <span className="text-[12px] text-muted-foreground">Unsaved changes</span>}
                <Button size="sm" onClick={save} disabled={!dirty || saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save {plan.name}
                </Button>
            </footer>
        </section>
    )
}
