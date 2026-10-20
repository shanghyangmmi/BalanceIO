import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { SmoothScrollProvider } from "@/components/landing/scroll-engine"
import { LedgerMachineHero } from "@/components/landing/ledger-machine-hero"
import { BalanceBeam } from "@/components/landing/balance-beam"
import { Pipeline } from "@/components/landing/pipeline"
import { ReadoutStrip, StandardsBand, MachineClose } from "@/components/landing/machine-sections"
import { ModulesShowcase } from "@/components/landing/modules-showcase"

/**
 * BalanceIO Landing — "The Ledger Machine".
 *
 * The page is staged as a machine in operation. The hero follows one
 * transaction all the way through - it arrives, splits into the two
 * sides that must agree, lands in the ledger, throws off its tax, and
 * closes as a report reading 0,00. Act I proves double entry
 * physically on a balance beam that
 * tips and rights itself with every transaction. Act II walks the
 * accounting cycle along a horizontally-scrolling track. The closing
 * movement lets the machine come to rest at difference 0.00.
 *
 * Motion is driven by one Lenis/GSAP loop (see scroll-engine) so pinned
 * scenes stay locked to the scrollbar, and every scene falls back to a
 * meaningful static state under prefers-reduced-motion.
 */
export default function Home() {
  return (
    <SmoothScrollProvider>
      <div className="relative flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-emerald-500/25">
        <SiteHeader />
        <main className="flex-1">
          <LedgerMachineHero />
          <BalanceBeam />
          <ReadoutStrip />
          <Pipeline />
          <ModulesShowcase />
          <StandardsBand />
          <MachineClose />
        </main>
        <SiteFooter />
      </div>
    </SmoothScrollProvider>
  )
}
