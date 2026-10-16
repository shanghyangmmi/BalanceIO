"use client"

import * as React from "react"
import { useSceneCanvas, useIsDark, prefersReducedMotion } from "./scroll-engine"

/**
 * The Ledger Core — a pseudo-3D lattice of ledger cells, rendered in
 * Canvas 2D with a hand-rolled perspective camera.
 *
 * Why Canvas 2D and not Three.js: this scene is ~500 flat quads. WebGL
 * would add ~150kb of runtime to draw rectangles that the 2D rasteriser
 * already handles at 60fps, and it would need a fallback path for weak
 * GPUs. Painter's-algorithm depth sorting is enough for a convex lattice.
 *
 * The lattice is a 3D grid of cells (a ledger extruded into depth). A
 * radial wave of "posting activity" travels outward from the centre,
 * lighting cells as it passes. The camera drifts on its own and leans
 * toward the cursor.
 */

const COLS = 14
const ROWS = 9
const LAYERS = 4
const SPACING_X = 34
const SPACING_Y = 26
const SPACING_Z = 90
const FOCAL = 620

interface Cell {
    x: number
    y: number
    z: number
    /** Distance from lattice centre — drives the activation wave. */
    dist: number
    /** Per-cell jitter so the wave never looks like a perfect ring. */
    phase: number
    /** Cells flagged as "value" render a figure bar instead of a tick. */
    valued: boolean
}

function buildLattice(): Cell[] {
    const cells: Cell[] = []
    const cx = (COLS - 1) / 2
    const cy = (ROWS - 1) / 2
    const cz = (LAYERS - 1) / 2

    for (let l = 0; l < LAYERS; l++) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                // Carve a soft elliptical hole in the front face so the
                // headline has clean air to sit in.
                const nx = (c - cx) / cx
                const ny = (r - cy) / cy
                if (l >= LAYERS - 2 && nx * nx * 0.55 + ny * ny * 1.6 < 0.34) continue

                const x = (c - cx) * SPACING_X
                const y = (r - cy) * SPACING_Y
                const z = (l - cz) * SPACING_Z

                cells.push({
                    x,
                    y,
                    z,
                    dist: Math.hypot(x, y * 1.4, z * 0.35),
                    phase: Math.random() * Math.PI * 2,
                    valued: Math.random() < 0.17,
                })
            }
        }
    }
    return cells
}

export function LedgerCore({ className }: { className?: string }) {
    const isDark = useIsDark()
    const lattice = React.useRef<Cell[]>([])
    if (lattice.current.length === 0) lattice.current = buildLattice()

    // Cursor target vs. eased actual — the lag is what makes the camera
    // feel like it has mass rather than snapping to the pointer.
    const target = React.useRef({ x: 0, y: 0 })
    const cam = React.useRef({ x: 0, y: 0 })
    const reduced = React.useRef(false)

    React.useEffect(() => {
        reduced.current = prefersReducedMotion()
        if (reduced.current) return
        if (window.matchMedia("(hover: none)").matches) return

        const onMove = (e: PointerEvent) => {
            target.current.x = (e.clientX / window.innerWidth - 0.5) * 2
            target.current.y = (e.clientY / window.innerHeight - 0.5) * 2
        }
        window.addEventListener("pointermove", onMove, { passive: true })
        return () => window.removeEventListener("pointermove", onMove)
    }, [])

    const canvasRef = useSceneCanvas(
        React.useCallback(
            (ctx, w, h, t) => {
                const cells = lattice.current
                const still = reduced.current
                const time = still ? 6.2 : t

                // Ease the camera toward the pointer (critically damped feel).
                cam.current.x += (target.current.x - cam.current.x) * 0.055
                cam.current.y += (target.current.y - cam.current.y) * 0.055

                // Autonomous drift keeps the scene alive with no cursor at all.
                const yaw = (still ? 0.18 : Math.sin(time * 0.11) * 0.22) + cam.current.x * 0.3
                const pitch = (still ? -0.1 : Math.sin(time * 0.083) * 0.1) - cam.current.y * 0.2

                const cosY = Math.cos(yaw)
                const sinY = Math.sin(yaw)
                const cosP = Math.cos(pitch)
                const sinP = Math.sin(pitch)

                const originX = w / 2
                const originY = h / 2
                // Scale the lattice to the viewport so it never crops awkwardly.
                const fit = Math.min(w / 620, h / 520, 1.25)

                const ink = isDark ? "255,255,255" : "24,32,40"
                const glow = isDark ? "52,211,153" : "13,148,136"

                type Projected = {
                    sx: number
                    sy: number
                    scale: number
                    depth: number
                    heat: number
                    cell: Cell
                }
                const drawList: Projected[] = []

                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i]

                    // Yaw about Y, then pitch about X.
                    const x1 = cell.x * cosY - cell.z * sinY
                    const z1 = cell.x * sinY + cell.z * cosY
                    const y2 = cell.y * cosP - z1 * sinP
                    const z2 = cell.y * sinP + z1 * cosP

                    const denom = FOCAL + z2
                    if (denom < 60) continue // behind the camera
                    const scale = (FOCAL / denom) * fit

                    // Radial activation wave: a travelling ring of posted entries.
                    const wave = still
                        ? 0.5 + 0.5 * Math.sin(cell.dist * 0.02 + cell.phase)
                        : Math.sin(time * 1.5 - cell.dist * 0.014 + cell.phase)
                    const heat = Math.max(0, wave) ** 3

                    drawList.push({
                        sx: originX + x1 * scale,
                        sy: originY + y2 * scale,
                        scale,
                        depth: z2,
                        heat,
                        cell,
                    })
                }

                // Painter's algorithm — far cells first so near cells occlude.
                drawList.sort((a, b) => b.depth - a.depth)

                for (let i = 0; i < drawList.length; i++) {
                    const p = drawList[i]
                    const cw = 20 * p.scale
                    const ch = 7 * p.scale

                    // Depth fade: distant layers recede into the background.
                    const depthFade = Math.max(0, Math.min(1, 1 - (p.depth + 200) / 620))
                    const base = (isDark ? 0.13 : 0.1) * depthFade
                    const lift = p.heat * (isDark ? 0.72 : 0.6) * depthFade

                    // The dormant cell: a hairline ledger rule.
                    ctx.fillStyle = `rgba(${ink},${base})`
                    ctx.fillRect(p.sx - cw / 2, p.sy - ch / 2, cw, ch)

                    if (lift > 0.012) {
                        ctx.fillStyle = `rgba(${glow},${lift})`
                        if (p.cell.valued) {
                            // A "figure" cell fills proportionally — reads as a number.
                            const fill = cw * (0.35 + p.heat * 0.65)
                            ctx.fillRect(p.sx - cw / 2, p.sy - ch / 2, fill, ch)
                        } else {
                            ctx.fillRect(p.sx - cw / 2, p.sy - ch / 2, cw, ch)
                        }

                        // Only the hottest cells get a halo — capping this is the
                        // difference between 60fps and 30fps on integrated GPUs.
                        if (p.heat > 0.72 && p.scale > 0.55) {
                            ctx.fillStyle = `rgba(${glow},${(p.heat - 0.72) * 0.5})`
                            ctx.fillRect(
                                p.sx - cw / 2 - 3 * p.scale,
                                p.sy - ch / 2 - 3 * p.scale,
                                cw + 6 * p.scale,
                                ch + 6 * p.scale
                            )
                        }
                    }
                }
            },
            [isDark]
        )
    )

    return (
        <canvas
            ref={canvasRef}
            aria-hidden
            className={className}
            style={{ width: "100%", height: "100%", display: "block" }}
        />
    )
}
