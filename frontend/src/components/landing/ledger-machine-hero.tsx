"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { EASE_HOUSE } from "@/lib/motion"
import { useIsDark, prefersReducedMotion } from "./scroll-engine"
import { readFonts, readPalette } from "./ledger-machine/paper"
import { ACTS, createLedgerScene } from "./ledger-machine/scene"

/**
 * Hero — "One transaction, all the way through."
 *
 * The type sits in its own column rather than floating over the scene.
 * The previous hero centred the headline on top of a full-bleed network,
 * and the labels collided with it: "TRANSACTIONS" landed behind the word
 * "for.", and the outermost statement names were clipped off both edges.
 * Separating the columns makes that structurally impossible.
 *
 * The headline is a claim; the lede underneath says what the product is
 * and who it is for, because a claim alone leaves a first-time visitor
 * guessing whether this is accounting software, an audit firm or a
 * consultancy. The act list stays, demoted to the legend for the scene.
 */

const HEAD_1 = ["Every", "figure"]
const HEAD_2 = ["accounted", "for."]

const word = {
  hidden: { y: "110%", opacity: 0 },
  show: (i: number) => ({
    y: "0%",
    opacity: 1,
    transition: { delay: 0.12 + i * 0.075, duration: 0.85, ease: EASE_HOUSE },
  }),
}

function MaskedLine({
  words,
  offset,
  accent,
}: {
  words: string[]
  offset: number
  accent?: boolean
}) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      {words.map((w, i) => (
        <motion.span
          key={w}
          custom={offset + i}
          variants={word}
          initial="hidden"
          animate="show"
          className={cn(
            "mr-[0.24em] inline-block will-change-transform",
            accent &&
              "italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent",
          )}
        >
          {w}
        </motion.span>
      ))}
    </span>
  )
}

export function LedgerMachineHero() {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [act, setAct] = React.useState(0)
  const [failed, setFailed] = React.useState(false)
  const isDark = useIsDark()

  React.useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    let scene: { dispose(): void } | null = null
    let cancelled = false

    const boot = async () => {
      // The card faces are drawn to a canvas, and canvas text does not
      // wait for webfonts. Without this the textures bake with the
      // fallback face and never repaint.
      try {
        await document.fonts.ready
      } catch {
        /* older browsers: fall through and draw with whatever is ready */
      }
      if (cancelled) return

      try {
        scene = createLedgerScene({
          canvas,
          host,
          palette: readPalette(host),
          fonts: readFonts(host),
          reducedMotion: prefersReducedMotion(),
          onAct: setAct,
        })
      } catch {
        // No WebGL, or the context was refused. The act list and the
        // headline still carry the whole message.
        setFailed(true)
      }
    }

    boot()
    return () => {
      cancelled = true
      scene?.dispose()
    }
    // Rebuilding on the theme flip repaints every texture from the
    // semantic tokens.
  }, [isDark])

  return (
    <section className="relative flex min-h-[100svh] w-full flex-col overflow-hidden lg:block">
      {/* ── Stage ──────────────────────────────────────────────────
          Full bleed on lg: the room runs edge to edge behind everything.
          Below lg it becomes a full-width landscape band under the
          headline instead - a portrait canvas cannot frame a landscape
          composition without either cropping it or shrinking it to
          nothing. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 1.2, ease: EASE_HOUSE }}
        ref={hostRef}
        className="relative order-2 aspect-[4/3] w-full lg:absolute lg:inset-0 lg:order-none lg:aspect-auto lg:h-full"
      >
        <canvas ref={canvasRef} className={cn("h-full w-full", failed && "hidden")} />
      </motion.div>

      {/* Readability scrim behind the type only.
          The stops are explicit because the default three-stop gradient
          ran its wash across two thirds of the frame and greyed out the
          cards on the left of the render - the statements in particular
          came out barely legible. It is opaque under the headline, gone
          by the time it reaches the stage. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block bg-gradient-to-r from-background from-0% via-background/75 via-[32%] to-transparent to-[52%]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 hidden h-[34rem] w-[34rem] rounded-full bg-emerald-500/[0.05] blur-[130px] lg:block"
      />

      {/* ── Type ───────────────────────────────────────────────────── */}
      <div className="relative z-10 order-1 mx-auto flex w-full max-w-7xl flex-1 items-center px-6 pt-28 pb-10 lg:min-h-[100svh] lg:py-0">
        <div className="max-w-[30rem]">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.8, ease: EASE_HOUSE }}
            className="mb-7 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground"
          >
            Accounting software for Indonesian companies
          </motion.p>

          <h1 className="font-display text-[13vw] font-bold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-[4.6rem]">
            <MaskedLine words={HEAD_1} offset={0} />
            <MaskedLine words={HEAD_2} offset={HEAD_1.length} accent />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.8, ease: EASE_HOUSE }}
            className="mt-7 max-w-[23rem] text-base leading-relaxed text-muted-foreground"
          >
            One general ledger for accounting, tax records, inventory, fixed
            assets and payroll, structured for PSAK reporting and Indonesian
            tax. Every figure on a statement traces back to the entry behind it.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8, ease: EASE_HOUSE }}
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
          >
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
              See plans and pricing
            </Link>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.8 }}
            className="mt-4 text-[12px] text-muted-foreground"
          >
            Free plan available. No card required to start.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-12 hidden max-w-[27rem] lg:block"
          >
            <div className="h-px w-full bg-foreground/10" />
            <ol className="mt-4 grid grid-cols-5 gap-3" aria-label="What the scene shows">
              {ACTS.map((label, i) => {
                const active = i === act
                return (
                  <li key={label} className="space-y-2">
                    {/* Drawn rule - the ledger gesture. It fills from the
                        left while its act is running. */}
                    <span className="relative block h-px overflow-hidden bg-foreground/15">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-full origin-left bg-emerald-600 transition-transform duration-700 ease-out dark:bg-emerald-400",
                          active ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        "block font-mono text-[9px] uppercase tracking-[0.12em] transition-colors duration-500",
                        active ? "text-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>

            {failed && (
              <p className="mt-6 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                Transaction, journal, ledger, tax, report - the same figure,
                carried through every one.
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.9 }}
        className="pointer-events-none absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-3 text-muted-foreground lg:flex"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.32em]">Scroll</span>
        <span className="relative h-10 w-px overflow-hidden bg-foreground/15">
          <motion.span
            animate={{ y: ["-100%", "100%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-x-0 h-1/2 bg-emerald-600 dark:bg-emerald-400"
          />
        </span>
      </motion.div>
    </section>
  )
}
