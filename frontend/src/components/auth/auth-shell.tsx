"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { EASE_HOUSE } from "@/lib/motion"
import { siteConfig } from "@/config/site"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * The frame every unauthenticated page shares: sign in, register, password
 * reset, email verification.
 *
 * Form on the left, the ledger on the right. The right panel is not
 * decoration: it is the product's one claim, shown as a balanced entry,
 * so the first screen a customer sees is already in the house register
 * (DESIGN-SYSTEM.md §1) rather than a floating glass card.
 */
export function AuthShell({
  eyebrow,
  title,
  lede,
  children,
  footer,
}: {
  /** Mono label above the title, e.g. "Workspace access". */
  eyebrow: string
  title: string
  lede?: React.ReactNode
  children: React.ReactNode
  /** Line under the form: the link to the sibling page. */
  footer?: React.ReactNode
}) {
  const reduce = useReducedMotion()

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-6 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between">
          <Wordmark />
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center py-12">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_HOUSE }}
            className="mx-auto w-full max-w-[380px]"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-[2.1rem]">
              {title}
            </h1>
            {lede && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lede}</p>
            )}

            <div className="mt-9">{children}</div>

            {footer && (
              <div className="mt-10 border-t border-foreground/10 pt-5 text-[13px] text-muted-foreground">
                {footer}
              </div>
            )}
          </motion.div>
        </main>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>© {new Date().getFullYear()} {siteConfig.name}</span>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
        </footer>
      </div>

      <LedgerPanel />
    </div>
  )
}

function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span className="h-7 w-7 overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimiser */}
        <img src="/images/logo-icon.svg" alt="" className="h-full w-full object-cover" />
      </span>
      <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
        {siteConfig.name}
      </span>
    </Link>
  )
}

/** One balanced entry. The figures are illustrative and labelled as such. */
const ENTRY = [
  { account: "1-1200", name: "Piutang usaha", en: "Trade receivables", dr: "111.000.000", cr: "" },
  { account: "4-1000", name: "Pendapatan", en: "Revenue", dr: "", cr: "100.000.000" },
  { account: "2-1300", name: "PPN keluaran", en: "Output VAT", dr: "", cr: "11.000.000" },
]

function LedgerPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-l border-foreground/10 bg-muted/40 lg:flex lg:flex-col lg:justify-between lg:p-14">
      {/* Ledger ruling: the 56px grid from the landing page, very faint. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(120,130,140,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,130,140,0.14)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)] dark:opacity-[0.22]"
      />

      <p className="relative font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        Jurnal umum · General journal
      </p>

      <div className="relative max-w-[460px]">
        <p className="font-display text-[2.4rem] font-bold leading-[1.08] tracking-tight text-foreground">
          Nothing posts until{" "}
          <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
            both sides agree.
          </span>
        </p>

        <div className="mt-10 rounded-xl border border-foreground/10 bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-3 text-left font-normal">Akun</th>
                <th className="px-5 py-3 text-right font-normal">Debit</th>
                <th className="px-5 py-3 text-right font-normal">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {ENTRY.map((line) => (
                <tr key={line.account} className="border-b border-foreground/[0.06] last:border-0">
                  <td className="px-5 py-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{line.account}</span>{" "}
                    <span className="text-foreground">{line.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{line.en}</span>
                  </td>
                  <td className="font-money px-5 py-3 text-right text-emerald-700 dark:text-emerald-400">
                    {line.dr}
                  </td>
                  <td className="font-money px-5 py-3 text-right text-cyan-700 dark:text-cyan-400">
                    {line.cr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-foreground/10 px-5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Selisih · Difference
            </span>
            <span className="font-money text-[13px] font-semibold text-foreground">0,00</span>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Illustrative entry · PPN 11 %
        </p>
      </div>

      <ul className="relative flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <li>PSAK</li>
        <li>PPN</li>
        <li>PPh 21</li>
        <li>e-Faktur</li>
        <li>UU KUP Pasal 28</li>
      </ul>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Form parts shared by the auth pages, so they cannot drift apart.     */
/* ------------------------------------------------------------------ */

export function AuthField({
  label,
  htmlFor,
  aside,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  /** Right-aligned element on the label row, e.g. "Forgot password". */
  aside?: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && <p className="text-[12px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Input styling for auth forms: taller than the dashboard default. */
export const authInputClass =
  "h-11 rounded-md border-foreground/15 bg-card px-3.5 text-[15px] placeholder:text-muted-foreground/60"

export function AuthError({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/[0.04] px-3.5 py-3 text-[13px] leading-relaxed text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/** A finished state (email sent, password changed): a rule, a line, an action. */
export function AuthNotice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "error"
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
      <span
        className={cn(
          "mt-[7px] h-2 w-2 shrink-0 rounded-full",
          tone === "success" && "bg-emerald-500",
          tone === "error" && "bg-destructive",
          tone === "neutral" && "bg-muted-foreground/50",
        )}
      />
      <div>{children}</div>
    </div>
  )
}
