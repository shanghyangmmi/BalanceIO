"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SmoothScrollProvider } from "@/components/landing/scroll-engine"
import { EASE_HOUSE } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * Features — what the product does, module by module.
 *
 * This page used to be six tabbed "capabilities" in a tilting card, with
 * check-mark bullets, icon badges, a spinning conic glow and a bento of
 * extras. Several of its claims were not true of the code: "IFRS",
 * "consolidated IDR reporting", "25 reports", asset "revaluation" (the
 * form edits cost and posts nothing), recurring journals whose "entries
 * post themselves" (they create drafts), and roles named Owner, Staff and
 * Auditor when the product's roles are Admin, Finance and Auditor.
 *
 * It is now laid out as a report: a contents list, the ledger's rules,
 * one exhibit block per module with the entry it posts, the statement set
 * and report index, the controls, and what is not built. The patterns are
 * the landing page's (modules-showcase, StandardsBand); nothing here is a
 * new visual idea.
 *
 * Every line is something the code does. Sources: root CLAUDE.md
 * (Accounting integrity, Tax module state, Payroll, Inventory and
 * warehouses, Fixed assets, Financial statements), PlansController for
 * plan availability, RolePermissions for roles, JobCatalogue for what
 * runs on a schedule. If one of those changes, change the line here.
 */

const reveal = {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
}

/* ── Hero ────────────────────────────────────────────────────────── */

const HEAD: { words: string[]; accent?: boolean }[] = [
    { words: ["One", "ledger."] },
    { words: ["Every", "module", "posts", "to", "it."], accent: true },
]

const CONTENTS = [
    { id: "ledger", no: "01", label: "The ledger" },
    { id: "modules", no: "02", label: "Modules" },
    { id: "statements", no: "03", label: "Statements and reports" },
    { id: "controls", no: "04", label: "Controls" },
    { id: "scope", no: "05", label: "Not yet built" },
] as const

function Hero() {
    let n = 0
    return (
        <section className="border-b border-foreground/10">
            <div className="mx-auto grid max-w-6xl gap-14 px-6 pt-32 pb-16 sm:pt-40 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end lg:pb-20">
                <div>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.05, duration: 0.8, ease: EASE_HOUSE }}
                        className="mb-7 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground"
                    >
                        Features
                    </motion.p>

                    {/* Mask reveal: the words rise from behind a clipping
                        edge, as on the landing hero. The accent is the one
                        italic gradient on this page. */}
                    <h1 className="font-display text-[2.6rem] font-bold leading-[1.06] tracking-tight text-foreground sm:text-6xl lg:text-[4.4rem]">
                        {HEAD.map((line) => (
                            <span key={line.words.join(" ")} className="block">
                                {line.words.map((w) => {
                                    const i = n++
                                    return (
                                        <span key={w + i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                                            <motion.span
                                                initial={{ y: "110%" }}
                                                animate={{ y: "0%" }}
                                                transition={{ delay: 0.1 + i * 0.06, duration: 0.85, ease: EASE_HOUSE }}
                                                className={cn(
                                                    "mr-[0.24em] inline-block will-change-transform",
                                                    line.accent &&
                                                        "italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400",
                                                )}
                                            >
                                                {w}
                                            </motion.span>
                                        </span>
                                    )
                                })}
                            </span>
                        ))}
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55, duration: 0.8, ease: EASE_HOUSE }}
                        className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground"
                    >
                        What BalanceIO does today: the rules the ledger enforces, the
                        entry each module posts and the plan it comes with, the
                        statements built from those entries, and the controls around
                        them. Where something is not built yet, this page says so.
                    </motion.p>
                </div>

                {/* Contents, as a report would open. */}
                <motion.nav
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75, duration: 0.8, ease: EASE_HOUSE }}
                    aria-label="Contents"
                    className="w-full lg:max-w-xs lg:justify-self-end"
                >
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                        Contents
                    </p>
                    <ol className="mt-4 border-t border-foreground">
                        {CONTENTS.map((c) => (
                            <li key={c.id} className="border-b border-foreground/10">
                                <a
                                    href={`#${c.id}`}
                                    className="group flex items-baseline gap-4 py-3 text-[14px] text-foreground transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
                                >
                                    <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                                        {c.no}
                                    </span>
                                    <span className="flex-1">{c.label}</span>
                                    <span
                                        aria-hidden
                                        className="h-px w-6 origin-left scale-x-0 bg-current transition-transform duration-300 group-hover:scale-x-100"
                                    />
                                </a>
                            </li>
                        ))}
                    </ol>
                </motion.nav>
            </div>
        </section>
    )
}

/* ── Section heading ─────────────────────────────────────────────── */

/** The landing's section head (modules-showcase), without the gradient. */
function SectionHead({
    no,
    label,
    title,
    note,
}: {
    no: string
    label: string
    title: string
    note: React.ReactNode
}) {
    return (
        <motion.div
            {...reveal}
            transition={{ duration: 0.8, ease: EASE_HOUSE }}
            className="mb-12 grid gap-6 lg:mb-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-8"
        >
            <div>
                <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-foreground/30" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                        {no} — {label}
                    </span>
                </div>
                <h2 className="font-display mt-5 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
                    {title}
                </h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground lg:justify-self-end">
                {note}
            </p>
        </motion.div>
    )
}

/** Term and description in a two-column grid of hairlines (StandardsBand). */
function RuleGrid({
    items,
    mono = true,
}: {
    items: readonly { term: string; text: string }[]
    mono?: boolean
}) {
    return (
        <dl className="grid gap-x-10 sm:grid-cols-2">
            {items.map((it, i) => (
                <motion.div
                    key={it.term}
                    {...reveal}
                    transition={{ delay: (i % 2) * 0.06 + Math.floor(i / 2) * 0.04, duration: 0.6, ease: EASE_HOUSE }}
                    className="border-t border-foreground/10 py-5"
                >
                    <dt
                        className={
                            mono
                                ? "font-mono text-[11px] uppercase tracking-[0.18em] text-foreground"
                                : "text-[14px] font-medium text-foreground"
                        }
                    >
                        {it.term}
                    </dt>
                    <dd className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{it.text}</dd>
                </motion.div>
            ))}
        </dl>
    )
}

/* ── 01 The ledger ───────────────────────────────────────────────── */

/**
 * Balance, status and immutability are checked in
 * ApplicationDbContext.SaveChangesAsync, which every writer passes
 * through. The period lock is checked by each posting path; the list in
 * the text is the set that calls it.
 */
const LEDGER_RULES = [
    {
        term: "Dr = Cr",
        text: "Debits must equal credits exactly; there is no rounding tolerance. In production a database trigger checks every posted entry a second time.",
    },
    {
        term: "Draft · Posted · Void",
        text: "An entry stays Draft until someone posts it. Posted and void entries cannot be edited, and only drafts can be deleted. A mistake is voided or reversed, and the original stays on the record.",
    },
    {
        term: "Segregation of duties",
        text: "The person who created an entry cannot also post it. On by default for every company.",
    },
    {
        term: "Period lock",
        text: "Journals, invoices, bills, vouchers, payroll runs, stock counts and asset postings dated inside a locked period are refused. Year-end closing posts one closing journal to retained earnings.",
    },
    {
        term: "Documents write their entries",
        text: "Posting an invoice, bill, receipt, payment, payroll run or asset charge writes its journal entry and links it to the document. Nobody retypes it into the ledger.",
    },
    {
        term: "Recurring entries",
        text: "A recurring template produces a draft entry each time it is run. Nothing recurring posts without someone posting it.",
    },
] as const

function LedgerSection() {
    return (
        <section id="ledger" className="scroll-mt-24 border-b border-foreground/10 py-24 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <SectionHead
                    no="01"
                    label="The ledger"
                    title="Nothing posts until both sides agree."
                    note="Balance and immutability are checked at the one point every write passes through, not in the screens, so an import is held to them as well."
                />
                <RuleGrid items={LEDGER_RULES} />
            </div>
        </section>
    )
}

/* ── 02 Modules (Exhibit 1) ──────────────────────────────────────── */

interface Module {
    name: string
    plan: string
    dr: string
    cr: string
    items: { term: string; text: string }[]
}

/**
 * Plan availability is PlansController.SeedDefaultPlans as it stands;
 * the commercial split is not final. The /pricing page currently says
 * something different, and that is a pending decision, not this page's.
 */
const MODULES: Module[] = [
    {
        name: "Accounting",
        plan: "Every plan",
        dr: "Trade receivables",
        cr: "Revenue · PPN keluaran",
        items: [
            {
                term: "Chart of accounts",
                text: "86 accounts in the standard chart, coded by class and named in Indonesian and English. An account with entries cannot change its code; it is deactivated instead.",
            },
            {
                term: "Sales and purchases",
                text: "Sales invoices and purchase bills post when approved. Discounts go to their own contra accounts instead of netting revenue or cost.",
            },
            {
                term: "Receipts and payments",
                text: "Receipt and payment vouchers post against the cash and bank accounts, inside the same period lock.",
            },
            {
                term: "Bank reconciliation",
                text: "Bank statements imported as CSV and matched to the ledger. Bank charges and interest post as adjusting entries.",
            },
            {
                term: "Foreign currency",
                text: "Invoices and bills in foreign currency post in rupiah at the document’s rate. Rates are kept by date and type, Kurs BI and Kurs Pajak (KMK). Period-end retranslation under PSAK 221 posts the unrealised gain or loss.",
            },
            {
                term: "Cost centres and budgets",
                text: "Journal lines carry an optional cost centre and project. Budgets are set per account and compared with posted actuals.",
            },
        ],
    },
    {
        name: "Tax",
        plan: "Pro and above",
        dr: "PPN keluaran",
        cr: "PPN masukan · PPN payable",
        items: [
            {
                term: "SPT Masa PPN",
                text: "The monthly 1111 summary from posted invoices and bills, and the settlement journal that clears PPN keluaran against PPN masukan.",
            },
            {
                term: "e-Faktur",
                text: "Faktur Pajak data exported as CSV for upload. NSFP is taken from the range you register; without one the invoice is marked pending, never numbered.",
            },
            {
                term: "Withholding",
                text: "PPh 21 from posted payroll runs; PPh 22, 23 and 4(2) recorded on purchase bills. A summary by type and an e-Bupot CSV export.",
            },
            {
                term: "DPP nilai lain",
                text: "Products and bill lines carry their DPP scheme, including DPP nilai lain at 11/12.",
            },
            {
                term: "Ekualisasi and rekonsiliasi fiskal",
                text: "PPN equalised against recorded revenue, and commercial profit reconciled to fiscal profit, with fiscal depreciation as a correction.",
            },
            {
                term: "DER test",
                text: "The debt-to-equity ratio under PMK-169/2015, for the interest deduction.",
            },
        ],
    },
    {
        name: "Inventory",
        plan: "Pro and above",
        dr: "Cost of goods sold",
        cr: "Inventory",
        items: [
            {
                term: "Moving-average cost",
                text: "One average cost per product across the company. Each movement carries the value it posts, so cost of sales equals the stock that left.",
            },
            {
                term: "Warehouses",
                text: "Stock is held per warehouse and moved by transfer. An issue that would take a warehouse below zero is refused.",
            },
            {
                term: "Orders and receipts",
                text: "A receipt adds stock at the order price against goods received not invoiced. The bill clears that account and books any price difference.",
            },
            {
                term: "Stock opname",
                text: "A physical count against the book quantity. The adjustment posts at the value of the stock it moves.",
            },
            {
                term: "Opening stock",
                text: "Stock entered with a new product posts against opening balance equity, so the books balance from the first day.",
            },
            {
                term: "Stock reports",
                text: "Stock on hand, stock card, ageing by receipt date, and valuation.",
            },
        ],
    },
    {
        name: "Fixed assets",
        plan: "Enterprise",
        dr: "Depreciation expense",
        cr: "Accumulated depreciation",
        items: [
            {
                term: "Register and acquisition",
                text: "Posting an acquisition debits the asset, credits cash or payables, and puts the asset in service at cost.",
            },
            {
                term: "Depreciation and amortisation",
                text: "The commercial charge is straight line and posted monthly. Intangible assets are amortised by the same schedule.",
            },
            {
                term: "Fiscal depreciation",
                text: "Kelompok 1 to 4 and buildings under Pasal 11 as amended by UU HPP, straight line or declining balance, beside the commercial charge as in Lampiran 1A.",
            },
            {
                term: "Disposal",
                text: "Removes cost and accumulated depreciation, books the proceeds and the gain or loss. A disposal dated before depreciation already charged is refused.",
            },
        ],
    },
    {
        name: "Payroll",
        plan: "Enterprise",
        dr: "Salaries · employer BPJS",
        cr: "PPh 21 · BPJS · net pay",
        items: [
            {
                term: "PPh 21",
                text: "TER rates of PP 58/2023 applied January to November. December settles the year under Pasal 17, less the TER already withheld.",
            },
            {
                term: "BPJS",
                text: "Ketenagakerjaan (JKK, JKM, JHT, JP) and Kesehatan, employer and employee shares, with the wage caps held as configuration.",
            },
            {
                term: "Pay runs",
                text: "One run per month, Draft to Posted to Void. Whoever calculated a run cannot post it, and a draft that no longer matches a fresh calculation is refused.",
            },
            {
                term: "Employees",
                text: "Employees are contacts with PTKP status, NIK and bank details. An unknown PTKP is withheld as TK/0, with a warning.",
            },
        ],
    },
]

function ModulesSection() {
    return (
        <section id="modules" className="scroll-mt-24 border-b border-foreground/10 py-24 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <SectionHead
                    no="02"
                    label="Modules"
                    title="Five modules, each judged by the entry it posts."
                    note="A module belongs in BalanceIO only if it posts to the general ledger. Each block below opens with that entry, then lists what the module does."
                />

                {/* The exhibit */}
                <div className="border-t border-foreground">
                    {MODULES.map((m) => (
                        <motion.article
                            key={m.name}
                            {...reveal}
                            transition={{ duration: 0.6, ease: EASE_HOUSE }}
                            className="grid gap-6 border-b border-foreground/10 py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12"
                        >
                            <div>
                                <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
                                    {m.name}
                                </h3>
                                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                    {m.plan}
                                </p>
                                <div className="mt-6 space-y-2 border-l border-foreground/15 pl-4 text-[14px] text-foreground">
                                    <p>
                                        <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                                            Dr
                                        </span>
                                        {m.dr}
                                    </p>
                                    <p>
                                        <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-400">
                                            Cr
                                        </span>
                                        {m.cr}
                                    </p>
                                </div>
                            </div>
                            <RuleGrid items={m.items} mono={false} />
                        </motion.article>
                    ))}

                    {/* The refusal, as a row of the same exhibit. */}
                    <motion.div
                        {...reveal}
                        transition={{ duration: 0.6, ease: EASE_HOUSE }}
                        className="grid gap-3 py-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12"
                    >
                        <p className="font-display text-2xl font-bold tracking-tight text-muted-foreground/70">
                            Not included
                        </p>
                        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                            CRM, attendance and online storefronts. None of them posts to the
                            general ledger, so none of them belongs in it. Use the tools you
                            already have for those.
                        </p>
                    </motion.div>
                </div>

                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Exhibit 1 · Typical entry per module · Plan availability as currently configured
                </p>
            </div>
        </section>
    )
}

/* ── 03 Statements and reports (Exhibit 2) ───────────────────────── */

/** TitleId / TitleEn as FinancialStatementsService prints them. */
const STATEMENTS = [
    { id: "Laporan Posisi Keuangan", en: "Statement of Financial Position (SoFP)" },
    { id: "Laporan Laba Rugi dan Penghasilan Komprehensif Lain", en: "Statement of Profit or Loss and Other Comprehensive Income" },
    { id: "Laporan Perubahan Ekuitas", en: "Statement of Changes in Equity" },
    { id: "Laporan Arus Kas", en: "Statement of Cash Flows (indirect method)" },
    { id: "Neraca Saldo", en: "Trial Balance" },
] as const

/** The arithmetic each statement carries, and must pass. */
const CHECKS = [
    "Assets = liabilities + equity",
    "Opening equity + movements = closing equity",
    "Closing cash = cash and bank accounts",
    "Total debits = total credits",
] as const

/**
 * One row per report screen that reads real data. Aliases (customer and
 * vendor balance are the ageing reports) are counted once, and the older
 * single-statement pages are left out: the statement set above replaces
 * them, and the old cash-flow endpoint does not reconcile.
 */
const REPORTS = [
    {
        group: "Ledger",
        reports: "General ledger, trial balance, notes to the financial statements",
        source: "Posted journal lines",
    },
    {
        group: "Receivables and payables",
        reports: "Aged receivables, aged payables, invoice list, bill list",
        source: "Invoices, bills and their payments",
    },
    {
        group: "Trade",
        reports: "Sales by customer, sales by product with cost of sales, purchases by vendor, purchases by product",
        source: "Posted documents, net of PPN, per currency",
    },
    {
        group: "Inventory",
        reports: "Stock on hand, stock card, inventory ageing, inventory valuation",
        source: "Stock movements",
    },
    {
        group: "Fixed assets",
        reports: "Asset register, depreciation schedule, fiscal depreciation (Lampiran 1A)",
        source: "Asset register and posted charges",
    },
    {
        group: "Tax",
        reports: "SPT Masa PPN, withholding summary, ekualisasi PPN, rekonsiliasi fiskal, DER test",
        source: "Invoices, bills and payroll runs, at report time",
    },
    {
        group: "Management",
        reports: "Budget variance, cash position",
        source: "Posted lines and budgets",
    },
] as const

function StatementsSection() {
    return (
        <section id="statements" className="scroll-mt-24 border-b border-foreground/10 py-24 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <SectionHead
                    no="03"
                    label="Statements and reports"
                    title="The PSAK statement set, in both languages."
                    note="Built from posted lines only, for any period, with a comparative if you want one. Printed on A4 with Indonesian on the left and English on the right, or in one language, and exported to Excel."
                />

                <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
                    {/* The set, laid out the way it prints. */}
                    <motion.ol
                        {...reveal}
                        transition={{ duration: 0.7, ease: EASE_HOUSE }}
                        className="border-t border-foreground"
                    >
                        {STATEMENTS.map((s, i) => (
                            <li
                                key={s.id}
                                className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-foreground/10 py-4 sm:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-6"
                            >
                                <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground sm:pt-0.5">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className="text-[14px] font-medium text-foreground">{s.id}</span>
                                <span className="col-start-2 text-[13px] text-muted-foreground sm:col-start-3 sm:text-right">
                                    {s.en}
                                </span>
                            </li>
                        ))}
                    </motion.ol>

                    <motion.div {...reveal} transition={{ delay: 0.1, duration: 0.7, ease: EASE_HOUSE }}>
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Checks on every statement
                        </p>
                        <ul className="mt-4 border-t border-foreground/10">
                            {CHECKS.map((c) => (
                                <li
                                    key={c}
                                    className="border-b border-foreground/10 py-3 font-mono text-[12px] text-foreground"
                                >
                                    {c}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                            Each statement shows its checks with it. A statement that fails one
                            says so, rather than printing as if it balanced.
                        </p>
                    </motion.div>
                </div>

                {/* Exhibit 2: the report index */}
                <div className="mt-20 border-t border-foreground">
                    <div className="hidden grid-cols-[13rem_minmax(0,1.8fr)_minmax(0,1fr)] gap-6 border-b border-foreground/10 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground lg:grid">
                        <span>Area</span>
                        <span>Reports</span>
                        <span>Built from</span>
                    </div>
                    {REPORTS.map((r, i) => (
                        <motion.div
                            key={r.group}
                            {...reveal}
                            transition={{ delay: i * 0.04, duration: 0.6, ease: EASE_HOUSE }}
                            className="grid gap-2 border-b border-foreground/10 py-5 lg:grid-cols-[13rem_minmax(0,1.8fr)_minmax(0,1fr)] lg:gap-6"
                        >
                            <p className="text-[14px] font-medium text-foreground">{r.group}</p>
                            <p className="text-[13px] leading-relaxed text-foreground/85">{r.reports}</p>
                            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">{r.source}</p>
                        </motion.div>
                    ))}
                </div>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Exhibit 2 · Reports by area · A module’s reports come with that module
                </p>
            </div>
        </section>
    )
}

/* ── 04 Controls ─────────────────────────────────────────────────── */

/**
 * Roles from RolePermissions (Owner, Manager, Staff and Viewer are
 * legacy aliases, not roles to sell). Audit coverage is the entity list
 * SaveChangesAsync logs. Support access is SupportAccessGrant.
 */
const CONTROLS = [
    {
        term: "Roles",
        text: "Admin, Finance and Auditor. Finance keeps the books but cannot manage users or the subscription. Auditor reads every module and can change nothing.",
    },
    {
        term: "Permissions",
        text: "Every API action requires a named permission. An automated test fails if an action is added without one.",
    },
    {
        term: "Audit log",
        text: "Changes to accounts, journals, contacts, products, invoices, bills, fixed assets and payroll are logged with the user and the time.",
    },
    {
        term: "UU KUP Pasal 28",
        text: "Each document keeps an append-only history from creation to void, hash-chained with SHA-256, for ten years. A shorter retention is refused.",
    },
    {
        term: "Company isolation",
        text: "Your membership is checked on every request, and every query is filtered to the company you are working in. A request without a company returns nothing.",
    },
    {
        term: "Support access",
        text: "Platform staff cannot open your books unless you grant time-limited access from a support ticket. Emergency access requires a stated reason. Both are logged.",
    },
    {
        term: "Sign-in",
        text: "Optional second factor with an authenticator app. Refresh tokens rotate, and presenting a revoked one ends every session of that user.",
    },
    {
        term: "Money",
        text: "Amounts are held as decimals, never floating point, and rounded half to even unless a regulation sets another rule.",
    },
] as const

function ControlsSection() {
    return (
        <section id="controls" className="scroll-mt-24 border-b border-foreground/10 py-24 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <SectionHead
                    no="04"
                    label="Controls"
                    title="Who may do what, and a record of what they did."
                    note="Roles decide what each person can do. The audit log and the document history keep what was done, for as long as Indonesian tax law asks you to keep your books."
                />
                <RuleGrid items={CONTROLS} />
            </div>
        </section>
    )
}

/* ── 05 Not yet built ────────────────────────────────────────────── */

/** From root CLAUDE.md: Tax module state, Payroll, Known issues. */
const NOT_BUILT = [
    {
        term: "Tax",
        text: "No submission to Coretax or DJP: files are exported for you to upload. PPnBM is not computed, and bukti potong numbers are not generated.",
    },
    {
        term: "Payroll",
        text: "No annualisation for leavers mid-year, no PPh 26, no Form 1721-A1, no payslips or bank transfer files. THR and bonuses are entered as other earnings.",
    },
] as const

function ScopeSection() {
    return (
        <section id="scope" className="scroll-mt-24 border-b border-foreground/10 py-24 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
                    <motion.div {...reveal} transition={{ duration: 0.8, ease: EASE_HOUSE }}>
                        <div className="flex items-center gap-3">
                            <span className="h-px w-8 bg-foreground/30" />
                            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                                05 — Not yet built
                            </span>
                        </div>
                        <h2 className="font-display mt-5 text-3xl font-bold leading-[1.1] tracking-tight text-foreground">
                            Stated here, not found later.
                        </h2>
                        <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                            The product records, organises and exports. Judgements on tax
                            treatment stay with your accountant, and tax and payroll output
                            should be reviewed by one before you rely on it.
                        </p>
                    </motion.div>
                    <RuleGrid items={NOT_BUILT} />
                </div>
            </div>
        </section>
    )
}

/* ── Close ───────────────────────────────────────────────────────── */

function Close() {
    return (
        <section className="py-24 sm:py-32">
            <motion.div
                {...reveal}
                transition={{ duration: 0.8, ease: EASE_HOUSE }}
                className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end"
            >
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                        Next step
                    </p>
                    <h2 className="font-display mt-5 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
                        Start with this month’s entries.
                    </h2>
                    <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                        The accounting module comes with every plan, the free one included.
                        Tax, inventory, fixed assets and payroll are added with a paid plan.
                    </p>
                </div>
                <div className="lg:justify-self-end">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                        <Link
                            href="/register"
                            className="group inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-colors hover:bg-foreground/85"
                        >
                            Create an account
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </Link>
                        <Link
                            href="/pricing"
                            className="text-[15px] font-medium text-foreground underline decoration-foreground/25 underline-offset-[6px] transition-colors hover:decoration-foreground"
                        >
                            Compare plans
                        </Link>
                    </div>
                    <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                        Free plan · No card required
                    </p>
                </div>
            </motion.div>
        </section>
    )
}

export default function FeaturesPage() {
    return (
        <SmoothScrollProvider>
            <div className="relative flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-emerald-500/25">
                <SiteHeader />
                <main className="flex-1">
                    <Hero />
                    <LedgerSection />
                    <ModulesSection />
                    <StatementsSection />
                    <ControlsSection />
                    <ScopeSection />
                    <Close />
                </main>
                <SiteFooter />
            </div>
        </SmoothScrollProvider>
    )
}
