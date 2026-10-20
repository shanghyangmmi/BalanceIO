# BalanceIO — Design System

**Status:** canonical as of August 2026
**Source of truth:** the landing page (`src/components/landing/`, `src/components/site-header.tsx`, `src/components/site-footer.tsx`)

This document is extracted from the actual codebase, not invented. Every
value below was read out of `globals.css`, `layout.tsx`, or the landing
components. Where the code is currently inconsistent, that is recorded
in [Known drift](#known-drift) rather than papered over.

Paste this into Claude Design when setting up the design system, and
treat it as the contract for any new screen built in the repo.

---

## 1. Brand thesis

> A healthy company is **in balance** across every dimension — not just
> its ledger, but its payroll, its stock, its assets, its tax position.
> **IO**: operational data in, equilibrium and decisions out.

Two registers, used for different jobs:

| Register | Where | Why |
|---|---|---|
| **Dr = Cr** — the concrete proof | Marketing, landing page | Demonstrable, specific, immediately credible |
| **Organisational balance** — the promise | Product, module hub | Broad enough to hold Payroll, Inventory, Assets, Tax |

**The name is the broad register, not the narrow one.** BalanceIO is not
named after Dr = Cr. It is named for a company being sound on every
front at once — its system, its tax, its payroll, its stock. Dr = Cr is
one arithmetic identity inside that, and a ledger can satisfy it while
the PPN is wrong, the PPh 21 was never withheld and the stock on the
shelf does not exist. Balance is not correctness.

Landing copy drifted away from this and had to be pulled back: a closing
section once promised "Books that close themselves", which both
overclaimed an automation and implied that balancing is the same as
being right.

Never lead with the abstract register alone. Every ERP vendor claims
"run your whole business"; almost none can show a beam settling to
0.00. The concrete proves the right to make the broad claim.

### The refusal

Every module must answer one question to earn its place:

> **Does it post to the general ledger?**

Inventory exists because it produces COGS. Fixed Assets exists because
it produces depreciation. Payroll qualifies because it produces salary
expense and PPh 21 withholding. **CRM does not qualify.** Neither does
attendance, nor a website builder.

This is a position the product can be judged against, and it is
deliberately exclusionary. Use it in copy.

---

## 2. Colour

### Semantic tokens

Defined in `globals.css` as OKLCH. **Always consume these, never the raw
values.** They flip automatically between themes.

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.986 0.005 175)` | `oklch(0.12 0.01 260)` |
| `--foreground` | `oklch(0.14 0.02 260)` | `oklch(0.98 0 0)` |
| `--card` | `oklch(0.995 0.003 175)` | `oklch(0.14 0.01 260)` |
| `--muted` | `oklch(0.96 0.007 175)` | `oklch(0.18 0.02 260)` |
| `--muted-foreground` | `oklch(0.40 0.02 260)` | `oklch(0.60 0.02 260)` |
| `--border` | `oklch(0.925 0.01 190)` | `oklch(0.2 0.02 260)` |
| `--primary` | `oklch(0.25 0.08 190)` deep teal | `oklch(0.7 0.12 190)` bright emerald |
| `--destructive` | `oklch(0.6 0.25 25)` | `oklch(0.4 0.25 25)` |
| `--radius` | `0.75rem` | — |

Light is **warm porcelain**, not white — there is a slight silk tint
(hue 175) in the background and card. Dark is **ink black** with a cool
blue cast (hue 260). Do not substitute pure `#fff` / `#000`.

### Accent — structure is locked, hue is open

Colour here is treated as **roles**, not fixed swatches. A designer
(human or Claude Design) may re-pitch the hues; what may not change is
the role structure, because these colours carry meaning inside the
product rather than decorating it.

#### Locked — the semantic contract

| Role | Meaning | Must be |
|---|---|---|
| **Primary** | debit side, posted, balanced, "good" | one hue, used everywhere |
| **Secondary** | credit side, return paths, carry-forward | a *distinct* hue, clearly not the primary |
| **Warning** | out of balance, in-flight, attention | warm, unmistakably different from both |
| **Destructive** | overdue, rejected, void | red family |

Why this is not negotiable: the primary/secondary pair is **read as
Dr/Cr** in the balance beam, the navbar progress split, and the flow
network. If the two hues drift close together, or swap roles between
screens, the product stops being legible. Warning must never be used
decoratively — an amber pill has to mean something is wrong.

Also locked, for accessibility rather than taste:

- Light and dark mode use **different stops** of the same hue. Never
  the same value in both — a stop that passes contrast on porcelain
  will not pass on ink.
- Consume the semantic tokens. Raw hex does not respond to the theme
  (31 literals in `components/dashboard` — see §7).

#### Open — explore freely

- The actual hues. The current emerald→teal→cyan is a **starting
  point, not a cage.**
- Exact stops and how many steps the ramp needs.
- Gradient composition and direction.
- Neutral temperature: the current light is warm porcelain (hue 175),
  dark is cool ink (hue 260). That pairing is unusual and worth
  keeping, but the specific temperatures are open.
- Whether supporting accents beyond the core pair are needed at all.

**Brief for Claude Design:** the palette must read as *financial
infrastructure a CFO would sign off on* — closer to a Big 4 report or a
Bloomberg terminal than to a consumer app. Blue is over-subscribed in
this category; the current green/teal direction differentiates and
should be the default assumption unless something demonstrably stronger
emerges. Bring options, keep the role structure.

#### One caution

Adventurous colour is the **wrong lever** for looking less
machine-made. The reference site for this project (pear.no) is very
nearly monochrome — its distinctiveness comes entirely from
typography, copy and motion. Most award-winning work is *restrained*
in colour, not loud.

In accounting software specifically, the aesthetic job is
trustworthiness. A palette that reaches too hard undermines the whole
positioning. Differentiate through craft and restraint; let colour be
quietly unusual rather than noisy.

### Dark mode

Tailwind v4 defaults `dark:` to the OS media query, but `next-themes`
toggles a class. `globals.css` therefore declares:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

**Do not remove this line.** Without it the in-app theme toggle only
half-works — a bug already fixed once.

---

## 3. Typography

Four faces, all self-hosted via `next/font` (no render-blocking
`@import` — that was removed deliberately).

| Face | Variable | Role |
|---|---|---|
| **Geist Sans** | `--font-geist-sans` | UI default, body |
| **Geist Mono** | `--font-geist-mono` | Codes, references, labels, folio numbers |
| **Merriweather** | `--font-document-serif` | Display headlines, wordmark → `.font-display` |
| **Lato** | `--font-document` | Printed documents (invoices, statements) |

### Numerals — non-negotiable

```css
table, thead, tbody, td, th { font-variant-numeric: tabular-nums lining-nums; }
.font-money { font-variant-numeric: tabular-nums lining-nums slashed-zero; letter-spacing: -0.01em; }
```

Every figure that represents money uses `.font-money` or sits in a
table. Slashed zero exists because `0` and `O` are ambiguous in a
ledger, and a misread figure in accounting software is not a cosmetic
failure.

### Scale

| Level | Class | Face |
|---|---|---|
| Hero | `text-[12.5vw] sm:text-6xl lg:text-[5.4rem]` | display |
| Section h2 | `text-3xl sm:text-4xl lg:text-5xl` | display |
| Card h3 | `text-base` / `text-lg`, `font-semibold` | sans |
| Body | `text-sm` / `text-[13px]`, `leading-relaxed` | sans |
| Eyebrow | `text-[11px] font-bold uppercase tracking-[0.28em]` | sans |
| Data label | `text-[10px] uppercase tracking-[0.2em]` | mono |

Headline leading is tight: `leading-[1.02]` hero, `leading-[1.1]`
section. Tracking is `tracking-tight` on display, wide on eyebrows.

### The italic gradient trap

Gradient text on italic Merriweather **clips its descenders and
ascenders**. Every instance must carry the fix:

```html
<span class="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r ... bg-clip-text text-transparent">
```

`box-decoration-clone` matters as much as the padding, and was missing
for a long time. Under the default `box-decoration-break: slice`, padding
on an inline element applies only to its **last line box** — so a
headline that wraps keeps its overhang on the final line and clips every
line before it. "Nothing posts until both sides agree." wrapped to three
lines and lost the *h* of "both"; "One platform, complete coverage."
wrapped to two and lost the *e* of "complete". Both read as font bugs
and were not.

One consequence worth knowing: with `clone`, the gradient restarts on
each line rather than sweeping across the whole block. That is the
intended look here — every line gets the full emerald-to-cyan travel.

---

## 4. Surface & depth

The system builds depth with **hairlines and tonal shifts, not
shadows**. This is the single strongest signal separating it from
generic SaaS.

- Borders: `border-foreground/10`, `border-zinc-900/10 dark:border-white/10`
- Rules: `h-px` with `bg-foreground/10`, or gradient-to-transparent
- Cards: `bg-card/60` + `backdrop-blur-sm` + hairline border
- Grids: `[background-image:linear-gradient(...)] [background-size:56px_56px]`
  at `opacity-[0.35] dark:opacity-[0.22]`
- Ambient glow: large-radius `blur-[100px]`–`blur-[130px]` at very low
  alpha (`/[0.05]`), never a hard gradient

**Shadows** are permitted only on genuinely floating chrome — the navbar
pill, dropdown panels, toasts. Not on in-flow cards.

---

## 5. Motion

### Curves

| Use | Value |
|---|---|
| Entrances, reveals, transforms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Physical objects | spring, see below |
| Scroll-linked | `ease: "none"` — scroll *is* the timing |

`[0.16, 1, 0.3, 1]` is the house curve: fast pickup, long graceful
settle. It appears 5× in the landing components and should be the
default for anything that enters.

### Spring presets

Standardise on **three**, in place of the twenty-odd ad-hoc configs
currently in the code (see [Known drift](#known-drift)):

```ts
export const SPRING = {
  /** Page/section entrances, large elements */
  soft:   { type: "spring", stiffness: 100, damping: 20 },
  /** Cards, list items, layout shifts */
  medium: { type: "spring", stiffness: 220, damping: 22 },
  /** Cursor-tracked, hover, magnetic — must feel immediate */
  snappy: { type: "spring", stiffness: 350, damping: 30 },
} as const
```

`stiffness: 100, damping: 20` is already the most-used config (6
occurrences); it becomes `soft`.

### Signature techniques

These are the house style. Reuse them; do not invent parallel ones.

1. **Mask reveal** — words slide up from behind a clipping edge
   (`overflow-hidden` + `y: "110%" → "0%"`). Never a plain opacity fade
   for headlines; it reads as printed rather than faded in.
2. **Odometer** — digits roll into place on a 0–9 strip, staggered
   left-to-right. All headline figures.
3. **Pinned scrub** — GSAP ScrollTrigger with `pin: true, scrub`.
   Scroll drives a deterministic progress value; nothing time-based, so
   reverse scrubbing replays exactly.
4. **Drawn rule** — hairlines scale in from `origin-left`. Used for nav
   hover underlines and section dividers. It is the ledger gesture.
5. **Named acts** — major sections carry chapter labels (`Act I —
   Double entry`). The page has a narrative arc, not a section stack.

### Performance rules

Learned the hard way while building the canvas scenes:

- Transform and opacity only. Never animate layout properties.
- Canvas: cap DPR at 2; `IntersectionObserver` to stop offscreen work
  entirely; cap halo/glow draws to the nearest elements only.
- One rAF loop. Lenis is driven by the GSAP ticker so the two never
  contend — see `scroll-engine.tsx`.
- Canvas `ctx.font` **cannot resolve CSS variables.** Use a literal
  font stack. This has bitten once already.
- Every scene needs a meaningful `prefers-reduced-motion` fallback —
  a static end state, not a blank box.

---

## 6. Voice

The hardest part to get right, and the thing that most separates
handmade sites from generated ones.

**Take a position.** Copy that nobody could disagree with reads as
machine-written. "Runs your entire back office in one place" is true
and inert. "Nothing posts until both sides agree" is a claim.

**State refusals.** The ledger test above is a refusal, and refusals are
credible in a way that promises are not.

**Structure as chapters.** Named acts, not "Features / Benefits / CTA".

**Sentence case, tight sentences, no filler.** Banned: *seamless,
leverage, empower, unlock, revolutionise, simply, just, effortlessly.*

**Terminology is formal and correct.** "Statement of Financial Position
(SoFP)", not "Balance Sheet report". The audience are accountants; the
vocabulary is a credibility signal. Spell out statement names in full,
with the abbreviation in parentheses.

**Indonesian regulatory terms stay Indonesian.** PPN, PPh 21, Faktur
Pajak, Coretax, PSAK. Do not translate them into English approximations.

**Never claim the product determines tax.** The tax module records,
tracks and exports — it does not decide a transaction's treatment. A
journal entry alone does not carry enough to conclude what is owed, and
copy that says otherwise moves a professional judgement, and the
liability attached to it, onto BalanceIO. Landing copy has already had
to be pulled back once from "the PPN it creates".

Safe verbs: *track, record, organise, export, support, reconcile.*
Unsafe: *determine, calculate your tax, decide, file for you.*

---

## 7. Known drift

Recorded honestly so it can be fixed. The October 2026 pass cleared the
dashboard of the legacy patterns; what remains is listed here.

| Issue | Extent | Action |
|---|---|---|
| `.text-gradient` headings | **0** (was 40 files) | Class deleted from `globals.css`. Working screens use `PageHeading`. |
| `shadow-*` on in-flow cards | **0** in-flow (was 57 in `app/dashboard`) | `card.tsx` and `tabs.tsx` are hairline. Remaining shadows are floating chrome or paper previews. |
| Raw hex colours | **0** in product code (was 31 in `components/dashboard`) | Print CSS for statements keeps `#fff`/`#555` deliberately. |
| Off-palette hues | **0** (was 445 uses) | Blue/indigo became cyan, purple/pink neutral, orange amber, rose red. |
| ~20 distinct spring configs | landing components | Collapse to the three presets in §5 (`lib/motion.ts`). |
| i18n coverage | nav labels only | All other UI strings are English; Indonesian regulatory terms stay Indonesian. |

### Where the drift actually lives

Measured after the pass:

| Folder | Files | `.text-gradient` | `shadow-{sm..2xl}` uses | hex literals |
|---|---|---|---|---|
| `components/ui` | 34 | 0 | 8 (dropdowns, dialogs, toasts) | 0 |
| `components/landing` | 12 | 0 | 3 | 0 |
| `components/dashboard` | 18 | 0 | 3 | 0 |
| `app/dashboard` | 116 | 0 | 2 | 0 |

The whole of `src` can now be imported into Claude Design as a reference.

---

## 8. Module hub

Built: `/dashboard` is the module map (`app/dashboard/(hub)`), backed by
`GET /api/Dashboard/module-health` (`ModuleHealthService`). Each card shows
the module's balance state and is its entry point. Figures are computed
server-side so they match the reports.

| Module | In balance when |
|---|---|
| Accounting | Dr = Cr, no unposted entries, period lock current |
| Payroll | All staff paid, PPh 21 accrued and remitted (not built; inactive) |
| Inventory | Book quantity matches last stock count |
| Fixed Assets | Depreciation posted through current period |
| Tax | Output/input reconciled, no filing overdue |

State colours follow §2: emerald balanced, amber attention, destructive
overdue. Never decorative.
