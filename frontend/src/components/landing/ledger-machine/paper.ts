import * as THREE from "three"

/**
 * Card faces are drawn to a 2D canvas and used as textures.
 *
 * Two rules from DESIGN-SYSTEM.md shape this file, and both have bitten
 * this codebase before:
 *
 *   1. Canvas `ctx.font` cannot resolve CSS variables. Worse here, the
 *      faces are loaded through next/font under generated family names,
 *      so a literal "Geist Sans" would silently fall back. The families
 *      are read back off the live DOM instead.
 *   2. Raw hex does not respond to the theme. Every colour below is
 *      resolved from a semantic token through a probe element, so the
 *      textures follow the theme toggle exactly rather than approximating
 *      it.
 */

export interface Palette {
  /** Page background. The scene fog blends into this, so distant cards
   *  dissolve into the page rather than ending at a hard edge. */
  background: string
  paper: string
  ink: string
  muted: string
  line: string
  accent: string
  secondary: string
  isDark: boolean
}

export interface Fonts {
  sans: string
  mono: string
}

/** Resolves `var(--token)` to a concrete rgb() the canvas can use. */
function resolveToken(probe: HTMLElement, token: string): string {
  probe.style.color = `var(${token})`
  return getComputedStyle(probe).color
}

export function readPalette(root: HTMLElement): Palette {
  const probe = document.createElement("span")
  probe.style.cssText = "position:absolute;opacity:0;pointer-events:none"
  root.appendChild(probe)

  const isDark = document.documentElement.classList.contains("dark")
  const palette: Palette = {
    background: resolveToken(probe, "--background"),
    paper: resolveToken(probe, "--card"),
    ink: resolveToken(probe, "--foreground"),
    muted: resolveToken(probe, "--muted-foreground"),
    line: resolveToken(probe, "--border"),
    // The accent pair is read as debit and credit. Light and dark take
    // different stops of the same hue.
    accent: isDark ? "rgb(52, 211, 153)" : "rgb(4, 120, 87)",
    secondary: isDark ? "rgb(34, 211, 238)" : "rgb(8, 145, 178)",
    isDark,
  }

  probe.remove()
  return palette
}

export function readFonts(root: HTMLElement): Fonts {
  const sansProbe = document.createElement("span")
  const monoProbe = document.createElement("span")
  sansProbe.style.cssText = monoProbe.style.cssText =
    "position:absolute;opacity:0;pointer-events:none"
  monoProbe.className = "font-mono"
  root.append(sansProbe, monoProbe)

  const fonts: Fonts = {
    sans: getComputedStyle(sansProbe).fontFamily,
    mono: getComputedStyle(monoProbe).fontFamily,
  }

  sansProbe.remove()
  monoProbe.remove()
  return fonts
}

// ── card content ────────────────────────────────────────────────────

export interface CardRow {
  label: string
  value?: string
  /** Tints the value: debit side, credit side, or plain ink. */
  tone?: "accent" | "secondary" | "ink"
}

export interface CardSpec {
  /** Small mono line across the top. */
  eyebrow: string
  /** Right-hand mono reference, e.g. a document number. */
  reference?: string
  title: string
  rows: CardRow[]
  /** Emphasised bottom line, e.g. the total. */
  footLabel?: string
  footValue?: string
  footTone?: "accent" | "secondary" | "ink"
  /** Colour of the 6px rule under the header. */
  rule?: "accent" | "secondary" | "line"
}

const W = 1024
const H = 640
const PAD = 58
const RADIUS = 26

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Ink at reduced strength, via alpha on the context rather than by
 * building a colour string.
 *
 * The first version of this parsed the resolved token with a regex and
 * reassembled it as `rgba(...)`. That was wrong in a way that only showed
 * up in one theme: Chrome resolves these OKLCH tokens to **lab()**, not
 * rgb, so `--foreground` in dark mode came back as
 * `lab(97.68, -0.0000298, 0.0000119)` and the regex read the lightness as
 * red - producing near-black red labels. Light mode escaped by luck,
 * because lab(2.43, -0.08, -4.14) reassembles to something almost black,
 * which is what that theme wanted anyway.
 *
 * `globalAlpha` sidesteps the whole problem: it works with whatever
 * format the browser hands back, today or after the next colour-spec
 * change.
 */
function inkAt(ctx: CanvasRenderingContext2D, p: Palette, strength: number) {
  ctx.globalAlpha = strength
  ctx.fillStyle = p.ink
}

function solid(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 1
}

function toneColour(tone: CardRow["tone"], p: Palette) {
  if (tone === "accent") return p.accent
  if (tone === "secondary") return p.secondary
  return p.ink
}

/**
 * Draws one card face. Depth comes from a hairline border and a tonal
 * header band - the same rule the rest of the product follows, since a
 * drop shadow painted into a texture reads as dirt once the card tilts.
 */
export function drawCard(spec: CardSpec, p: Palette, f: Fonts): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  // Body
  roundedRect(ctx, 2, 2, W - 4, H - 4, RADIUS)
  ctx.fillStyle = p.paper
  ctx.fill()
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = p.ink
  ctx.stroke()
  solid(ctx)

  // Header band, very slightly off the paper tone.
  ctx.save()
  roundedRect(ctx, 2, 2, W - 4, H - 4, RADIUS)
  ctx.clip()
  ctx.fillStyle = p.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
  ctx.fillRect(0, 0, W, 132)
  ctx.restore()

  // Eyebrow + reference
  ctx.font = `700 23px ${f.mono}`
  ctx.textBaseline = "middle"
  inkAt(ctx, p, 0.62)
  ctx.letterSpacing = "4px"
  ctx.textAlign = "left"
  ctx.fillText(spec.eyebrow.toUpperCase(), PAD, 50)

  if (spec.reference) {
    ctx.textAlign = "right"
    ctx.fillText(spec.reference.toUpperCase(), W - PAD, 50)
  }
  ctx.letterSpacing = "0px"

  // Title
  solid(ctx)
  ctx.textAlign = "left"
  ctx.font = `600 40px ${f.sans}`
  ctx.fillStyle = p.ink
  ctx.fillText(spec.title, PAD, 98)

  // Rule under the header
  if (spec.rule === "accent" || spec.rule === "secondary") {
    ctx.fillStyle = spec.rule === "accent" ? p.accent : p.secondary
  } else {
    inkAt(ctx, p, 0.3)
  }
  ctx.fillRect(PAD, 131, W - PAD * 2, spec.rule && spec.rule !== "line" ? 4 : 2)
  solid(ctx)

  // Rows
  let y = 196
  ctx.font = `500 31px ${f.sans}`
  for (const row of spec.rows) {
    ctx.textAlign = "left"
    inkAt(ctx, p, 0.86)
    ctx.fillText(row.label, PAD, y)

    if (row.value) {
      solid(ctx)
      ctx.textAlign = "right"
      ctx.font = `600 33px ${f.mono}`
      ctx.fillStyle = toneColour(row.tone, p)
      ctx.fillText(row.value, W - PAD, y)
      ctx.font = `500 31px ${f.sans}`
    }
    y += 58
  }

  // Foot
  if (spec.footLabel) {
    const fy = H - 78
    inkAt(ctx, p, 0.28)
    ctx.fillRect(PAD, fy - 46, W - PAD * 2, 2)

    ctx.textAlign = "left"
    ctx.font = `700 25px ${f.mono}`
    ctx.letterSpacing = "3px"
    inkAt(ctx, p, 0.66)
    ctx.fillText(spec.footLabel.toUpperCase(), PAD, fy)
    ctx.letterSpacing = "0px"

    if (spec.footValue) {
      solid(ctx)
      ctx.textAlign = "right"
      ctx.font = `600 44px ${f.mono}`
      ctx.fillStyle = toneColour(spec.footTone, p)
      ctx.fillText(spec.footValue, W - PAD, fy)
    }
  }

  solid(ctx)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}
