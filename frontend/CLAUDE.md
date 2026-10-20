# BalanceIO — frontend

Next.js 16 (App Router, static export) · React 19 · Tailwind v4 ·
shadcn/ui (Radix) · TanStack Query + Virtual · Framer Motion · GSAP +
Lenis. Backend is .NET 8 via `src/lib/api-client.ts`.
`npm run build` passes; `npm run lint` passes with 0 errors (warnings remain,
mostly `no-explicit-any`).

**`DESIGN-SYSTEM.md` in this folder is the design source of truth.**
Read it before making visual decisions.

---

## Non-negotiables

### Money and numbers

- Every monetary figure uses `.font-money` or sits in a `<table>`
  (both apply `tabular-nums lining-nums`; `.font-money` adds
  `slashed-zero`). A misread figure in accounting software is not a
  cosmetic failure.
- Never `float`/`double` semantics for money anywhere in the stack.

### Colour carries meaning

The accent pair is **read as debit and credit** — in the balance beam,
the navbar progress split, and the hero flow network:

| Role | Currently | Meaning |
|---|---|---|
| primary | emerald | debit side, posted, balanced |
| secondary | cyan | credit side, return/carry-forward |
| warning | amber | **out of balance** — never decorative |
| destructive | red | overdue, rejected, void |

Hues may be re-pitched; the role structure may not. If the two accent
hues drift close together the product stops being legible.

Light and dark mode use **different stops** of the same hue
(`emerald-600/700` on paper, `emerald-400` on ink). Consume the OKLCH
semantic tokens in `globals.css` — raw hex does not respond to the
theme. Product code has none left; data-driven colours use Tailwind's
theme variables (`var(--color-emerald-800)`), never hex.

### Dark mode

`globals.css` declares `@custom-variant dark (&:where(.dark, .dark *));`
because Tailwind v4 defaults `dark:` to the OS media query while
`next-themes` toggles a class. **Do not remove that line** — without it
the theme toggle only half-works.

### Depth

Hairlines and tonal shifts, not shadows. `border-foreground/10`, `h-px`
rules, `bg-card/60` + `backdrop-blur-sm`. Shadows only on genuinely
floating chrome (navbar pill, dropdowns, toasts) — never on in-flow
cards.

### Typography

Merriweather (`.font-display`) for display headlines, Geist Sans for UI,
Geist Mono for codes and data labels, Lato for printed documents.

Gradient text on **italic** Merriweather clips its ascenders and
descenders. Every instance needs
`box-decoration-clone pr-[0.14em] pb-[0.08em]`.

`box-decoration-clone` is not optional and was missing for a long time.
Padding on an inline element applies only to its **last line box** under
the default `box-decoration-break: slice` — so a headline that wraps
keeps its overhang on the final line and clips every line before it.
"Nothing posts until both sides agree." wrapped to three lines and lost
the *h* of "both"; "One platform, complete coverage." wrapped to two and
lost the *e* of "complete". Both looked like font bugs and were not.

---

## Motion

House curve for anything entering: `cubic-bezier(0.16, 1, 0.3, 1)`.
Scroll-linked animation uses `ease: "none"` — scroll *is* the timing.

Three spring presets, in place of the ~20 ad-hoc configs currently in
the landing components:

```ts
soft:   { type: "spring", stiffness: 100, damping: 20 }  // sections, large elements
medium: { type: "spring", stiffness: 220, damping: 22 }  // cards, list items
snappy: { type: "spring", stiffness: 350, damping: 30 }  // hover, cursor-tracked
```

Signature techniques (reuse, don't invent parallels): mask reveal for
headlines, odometer for figures, pinned scrub for scroll scenes, drawn
rule for underlines, named acts for sections.

**Performance rules learned the hard way:**

- Transform and opacity only. Never animate layout properties.
- Canvas: cap DPR at 2, stop work entirely when offscreen via
  `IntersectionObserver`, limit glow draws to the nearest elements.
- One rAF loop — Lenis is driven by the GSAP ticker so they never
  contend. See `src/components/landing/scroll-engine.tsx`.
- Canvas `ctx.font` **cannot resolve CSS variables**; use a literal
  font stack.
- Every scene needs a meaningful `prefers-reduced-motion` fallback —
  a static end state, not a blank box.

---

## Voice

Copy that nobody could disagree with reads as machine-written. Take a
position. State refusals.

The product's own refusal, which doubles as its scope rule:

> A module earns its place only if it **posts to the general ledger.**
> Inventory produces COGS. Fixed Assets produces depreciation. Payroll
> produces salary expense and PPh 21. CRM does not qualify.

- Sentence case. Tight sentences. No filler.
- Banned: *seamless, leverage, empower, unlock, revolutionise, simply,
  just, effortlessly.*
- Formal accounting terminology — "Statement of Financial Position
  (SoFP)", not "Balance Sheet report". Spell statement names out with
  the abbreviation in parentheses.
- Indonesian regulatory terms stay Indonesian: PPN, PPh 21, Faktur
  Pajak, Coretax, PSAK. Do not translate them.

---

## Page structure

- Working screens (lists, forms, settings) open with `PageHeading`
  (`components/dashboard/page-heading.tsx`): mono eyebrow, Merriweather
  title, one-line lede, actions right, hairline under. No gradient.
- Module overviews use `ModuleMasthead`; that is where the single italic
  gradient accent lives.
- Unauthenticated pages (sign in, register, reset, verify) render inside
  `AuthShell` (`components/auth/auth-shell.tsx`) and use its `AuthField`,
  `AuthError` and `AuthNotice`.
- Empty states: a small muted icon, a plain statement of what is missing,
  and the one action that fixes it. No icon tiles, no "Get started".
- Copy states facts the code guarantees. Before writing "signs out other
  sessions", "expires in one hour" or "submitted to DJP", find the line of
  code that does it.

## Retired patterns

`.text-gradient`, shadows on in-flow cards, animated background blobs,
`Sparkles` icons, raw hex and off-palette hues (purple, indigo, pink,
blue) were removed in October 2026. Paper previews of printed documents
keep a shadow: a sheet on a desk is genuinely floating. Do not
reintroduce any of the others.
