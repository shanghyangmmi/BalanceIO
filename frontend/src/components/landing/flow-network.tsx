"use client"

import * as React from "react"
import { useSceneCanvas, useIsDark, prefersReducedMotion } from "./scroll-engine"

/**
 * The Flow Network — the bookkeeping chain, modelled in 3D and turning
 * slowly on its own axis.
 *
 * Five stations run in the order value actually moves:
 *
 *   Transactions → Journal Entry → General Ledger → Financial
 *   Statements → Tax
 *
 * joined by lit conduits with pulses travelling forward. A faint dashed
 * return link closes Tax back to Transactions, because periods cycle.
 * Each station fans out to the things that actually live under it.
 *
 * Nodes are drawn as documents and currency tokens rather than orbs —
 * a ledger is made of paper and money, not spheres.
 *
 * The camera is deliberately FIXED. An earlier version let the pointer
 * drive yaw and pitch, which meant the horizon moved with the mouse and
 * the whole model read as unstable. Now only the chain rotates, about a
 * single vertical axis, so there is always a steady frame of reference.
 */

const FOCAL = 1050
const R_STATION = 250
const R_CHILD = 452
/** Fixed camera elevation. Never driven by input. */
const PITCH = -0.2

type IconKind = "doc" | "money"

interface Node {
    x: number
    y: number
    z: number
    /** Icon half-extent in model units. */
    size: number
    tier: 0 | 1
    label: string
    /** Second label line. Long statement names are authored pre-split
     *  rather than wrapped at runtime, so the break always lands in a
     *  sensible place instead of wherever the measure happens to fall. */
    label2?: string
    icon: IconKind
    pulse: number
}

interface Edge {
    a: number
    b: number
    mx: number
    my: number
    mz: number
    kind: "pipe" | "return" | "branch"
}

interface Particle {
    edge: number
    t: number
    speed: number
    dir: 1 | -1
    pipe: boolean
}

const CHAIN: {
    label: string
    children: { label: string; label2?: string; icon: IconKind }[]
}[] = [
    {
        label: "TRANSACTIONS",
        children: [
            { label: "Cash", icon: "money" },
            { label: "Accrued", icon: "money" },
            { label: "Rent", icon: "money" },
            { label: "Service", icon: "money" },
            { label: "Sales", icon: "money" },
            { label: "Purchase", icon: "money" },
        ],
    },
    {
        label: "JOURNAL ENTRY",
        children: [
            { label: "Debit", icon: "money" },
            { label: "Credit", icon: "money" },
            { label: "Description", icon: "doc" },
            { label: "Reference", icon: "doc" },
        ],
    },
    {
        label: "GENERAL LEDGER",
        children: [
            { label: "Posting", icon: "doc" },
            { label: "Adjustment", icon: "doc" },
            { label: "Balance", icon: "money" },
            { label: "Period Close", icon: "doc" },
        ],
    },
    {
        label: "FINANCIAL STATEMENTS",
        children: [
            { label: "Statement of Financial", label2: "Position (SoFP)", icon: "doc" },
            { label: "Statement of Comprehensive", label2: "Income (SoCI)", icon: "doc" },
            { label: "Statement of Cash", label2: "Flows (SoCF)", icon: "doc" },
            { label: "Statement of Changes", label2: "in Equity (SoCE)", icon: "doc" },
            { label: "Notes to Financial", label2: "Statements", icon: "doc" },
        ],
    },
    {
        label: "TAX",
        children: [
            { label: "PPN", icon: "money" },
            { label: "PPh 21", icon: "doc" },
            { label: "PPh 22", icon: "doc" },
            { label: "PPh 23", icon: "doc" },
            { label: "PPh 4(2)", icon: "doc" },
        ],
    },
]

function buildGraph() {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const stationIds: number[] = []

    // Stations sit on a flat horizontal ring. Flat is the point: with a
    // fixed camera elevation it projects to a clean ellipse, which gives
    // the eye a stable ground plane as the model turns.
    for (let i = 0; i < CHAIN.length; i++) {
        const a = (i / CHAIN.length) * Math.PI * 2 - Math.PI / 2
        stationIds.push(nodes.length)
        nodes.push({
            x: Math.cos(a) * R_STATION,
            y: 0,
            z: Math.sin(a) * R_STATION,
            size: 15,
            tier: 0,
            label: CHAIN[i].label,
            icon: "doc",
            pulse: 0,
        })
    }

    const link = (a: number, b: number, kind: Edge["kind"], bow: number, lift: number) => {
        const na = nodes[a]
        const nb = nodes[b]
        edges.push({
            a,
            b,
            mx: ((na.x + nb.x) / 2) * (1 + bow),
            my: (na.y + nb.y) / 2 + lift,
            mz: ((na.z + nb.z) / 2) * (1 + bow),
            kind,
        })
    }

    // Children fan outward and vertically from their station.
    for (let i = 0; i < CHAIN.length; i++) {
        const a = (i / CHAIN.length) * Math.PI * 2 - Math.PI / 2
        const kids = CHAIN[i].children
        for (let j = 0; j < kids.length; j++) {
            const mid = (kids.length - 1) / 2
            const spread = (j - mid) * 0.155
            const ang = a + spread
            // Extra vertical room where labels run to two lines, so the
            // statement names never collide with their neighbours.
            const rowGap = kids.some((k) => k.label2) ? 62 : 48
            const yy = (j - mid) * rowGap
            const rr = R_CHILD - Math.abs(j - mid) * 26

            const id = nodes.length
            nodes.push({
                x: Math.cos(ang) * rr,
                y: yy,
                z: Math.sin(ang) * rr,
                size: 9,
                tier: 1,
                label: kids[j].label,
                label2: kids[j].label2,
                icon: kids[j].icon,
                pulse: 0,
            })
            link(stationIds[i], id, "branch", 0.04, yy * 0.3)
        }
    }

    // The chain: 0→1→2→3→4, in order.
    for (let i = 0; i < CHAIN.length - 1; i++) {
        link(stationIds[i], stationIds[i + 1], "pipe", 0.13, -34)
    }
    // Tax → Transactions: the next period. Drawn faint and dashed since
    // it is a carry-forward, not part of the forward run.
    link(stationIds[CHAIN.length - 1], stationIds[0], "return", 0.13, -34)

    return { nodes, edges }
}

function buildParticles(edges: Edge[]): Particle[] {
    const list: Particle[] = []
    for (let e = 0; e < edges.length; e++) {
        const k = edges[e].kind
        const pipe = k === "pipe"
        const n = pipe ? 4 : k === "return" ? 2 : 1
        for (let i = 0; i < n; i++) {
            list.push({
                edge: e,
                t: pipe ? i / n : Math.random(),
                speed: pipe ? 0.2 : 0.11 + Math.random() * 0.12,
                dir: k === "branch" ? (Math.random() > 0.5 ? 1 : -1) : 1,
                pipe,
            })
        }
    }
    return list
}

/* ── Icon painters (billboarded: always square to the camera) ─────── */

function paintDoc(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    tone: string,
    alpha: number,
    lineAlpha: number
) {
    const w = s * 1.5
    const h = s * 2
    const fold = s * 0.62
    const l = x - w / 2
    const t = y - h / 2

    ctx.beginPath()
    ctx.moveTo(l, t)
    ctx.lineTo(l + w - fold, t)
    ctx.lineTo(l + w, t + fold)
    ctx.lineTo(l + w, t + h)
    ctx.lineTo(l, t + h)
    ctx.closePath()
    ctx.fillStyle = `rgba(${tone},${alpha * 0.16})`
    ctx.fill()
    ctx.strokeStyle = `rgba(${tone},${alpha})`
    ctx.lineWidth = Math.max(0.7, s * 0.11)
    ctx.stroke()

    // Folded corner.
    ctx.beginPath()
    ctx.moveTo(l + w - fold, t)
    ctx.lineTo(l + w - fold, t + fold)
    ctx.lineTo(l + w, t + fold)
    ctx.strokeStyle = `rgba(${tone},${alpha * 0.75})`
    ctx.stroke()

    // Ruled lines — only once the icon is big enough for them to read.
    if (s > 6) {
        ctx.strokeStyle = `rgba(${tone},${lineAlpha})`
        ctx.lineWidth = Math.max(0.5, s * 0.075)
        for (let i = 0; i < 3; i++) {
            const ly = t + h * (0.44 + i * 0.18)
            ctx.beginPath()
            ctx.moveTo(l + w * 0.18, ly)
            ctx.lineTo(l + w * (i === 2 ? 0.62 : 0.82), ly)
            ctx.stroke()
        }
    }
}

function paintMoney(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    tone: string,
    alpha: number
) {
    const r = s * 0.95

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${tone},${alpha * 0.18})`
    ctx.fill()
    ctx.strokeStyle = `rgba(${tone},${alpha})`
    ctx.lineWidth = Math.max(0.7, s * 0.12)
    ctx.stroke()

    // Inner rim gives the token some coin-like depth.
    ctx.beginPath()
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${tone},${alpha * 0.4})`
    ctx.lineWidth = Math.max(0.5, s * 0.07)
    ctx.stroke()

    ctx.font = `700 ${Math.round(r * 1.35)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = `rgba(${tone},${alpha})`
    ctx.fillText("$", x, y + r * 0.06)
    ctx.textBaseline = "alphabetic"
}

export function FlowNetwork({ className }: { className?: string }) {
    const isDark = useIsDark()
    const graph = React.useRef<ReturnType<typeof buildGraph> | null>(null)
    const particles = React.useRef<Particle[]>([])
    if (!graph.current) {
        graph.current = buildGraph()
        particles.current = buildParticles(graph.current.edges)
    }

    const lastT = React.useRef(0)
    const reduced = React.useRef(false)
    React.useEffect(() => {
        reduced.current = prefersReducedMotion()
    }, [])

    const canvasRef = useSceneCanvas(
        React.useCallback(
            (ctx, w, h, t) => {
                const g = graph.current
                if (!g) return
                const { nodes, edges } = g
                const parts = particles.current
                const still = reduced.current

                const dt = Math.min(0.05, Math.max(0, t - lastT.current))
                lastT.current = t

                // Single axis of rotation, constant rate, fixed elevation.
                const yaw = still ? 0.6 : t * 0.115
                const cosY = Math.cos(yaw)
                const sinY = Math.sin(yaw)
                const cosP = Math.cos(PITCH)
                const sinP = Math.sin(PITCH)

                const ox = w / 2
                const oy = h / 2 + h * 0.02
                const fit = Math.min(w / 1180, h / 760) * 1.24

                const ink = isDark ? "255,255,255" : "24,32,40"
                const glow = isDark ? "52,211,153" : "13,148,136"
                const cool = isDark ? "34,211,238" : "8,145,178"

                const project = (x: number, y: number, z: number) => {
                    const x1 = x * cosY - z * sinY
                    const z1 = x * sinY + z * cosY
                    const y2 = y * cosP - z1 * sinP
                    const z2 = y * sinP + z1 * cosP
                    const denom = FOCAL + z2
                    if (denom < 90) return null
                    const s = (FOCAL / denom) * fit
                    return { sx: ox + x1 * s, sy: oy + y2 * s, s, depth: z2 }
                }

                const fadeOf = (depth: number) =>
                    Math.max(0.1, Math.min(1, 1 - (depth + 430) / 1150))

                // ── Simulate ──
                if (!still) {
                    for (let i = 0; i < parts.length; i++) {
                        const p = parts[i]
                        p.t += p.speed * dt
                        if (p.t >= 1) {
                            p.t -= 1
                            const e = edges[p.edge]
                            nodes[p.dir === 1 ? e.b : e.a].pulse = 1
                            if (e.kind === "branch") {
                                p.dir = Math.random() > 0.5 ? 1 : -1
                            }
                        }
                    }
                    for (let i = 0; i < nodes.length; i++) nodes[i].pulse *= 0.94
                }

                const proj = nodes.map((n) => project(n.x, n.y, n.z))

                // ── Edges, far to near ──
                const eOrder = edges
                    .map((e, i) => {
                        const pa = proj[e.a]
                        const pb = proj[e.b]
                        return pa && pb ? { e, i, depth: (pa.depth + pb.depth) / 2 } : null
                    })
                    .filter((x): x is { e: Edge; i: number; depth: number } => x !== null)
                    .sort((a, b) => b.depth - a.depth)

                ctx.lineCap = "round"
                for (let k = 0; k < eOrder.length; k++) {
                    const { e, depth } = eOrder[k]
                    const pa = proj[e.a]!
                    const pb = proj[e.b]!
                    const pm = project(e.mx, e.my, e.mz)
                    if (!pm) continue
                    const fade = fadeOf(depth)

                    const path = () => {
                        ctx.beginPath()
                        ctx.moveTo(pa.sx, pa.sy)
                        ctx.quadraticCurveTo(pm.sx, pm.sy, pb.sx, pb.sy)
                        ctx.stroke()
                    }

                    if (e.kind === "pipe") {
                        // Layered strokes build a lit conduit; shadowBlur here
                        // would force an offscreen blur per stroke.
                        ctx.strokeStyle = `rgba(${glow},${0.07 * fade})`
                        ctx.lineWidth = 14 * pm.s
                        path()
                        ctx.strokeStyle = `rgba(${glow},${0.17 * fade})`
                        ctx.lineWidth = 5.5 * pm.s
                        path()
                        ctx.strokeStyle = `rgba(${glow},${0.55 * fade})`
                        ctx.lineWidth = Math.max(0.9, 1.5 * pm.s)
                        path()
                    } else if (e.kind === "return") {
                        ctx.setLineDash([5 * pm.s, 7 * pm.s])
                        ctx.strokeStyle = `rgba(${cool},${0.3 * fade})`
                        ctx.lineWidth = Math.max(0.7, 1.2 * pm.s)
                        path()
                        ctx.setLineDash([])
                    } else {
                        ctx.strokeStyle = `rgba(${ink},${0.16 * fade})`
                        ctx.lineWidth = 1
                        path()
                    }
                }

                // ── Particles ──
                for (let i = 0; i < parts.length; i++) {
                    const p = parts[i]
                    const e = edges[p.edge]
                    const na = nodes[p.dir === 1 ? e.a : e.b]
                    const nb = nodes[p.dir === 1 ? e.b : e.a]
                    const u = p.t
                    const iu = 1 - u
                    const px = iu * iu * na.x + 2 * iu * u * e.mx + u * u * nb.x
                    const py = iu * iu * na.y + 2 * iu * u * e.my + u * u * nb.y
                    const pz = iu * iu * na.z + 2 * iu * u * e.mz + u * u * nb.z
                    const pp = project(px, py, pz)
                    if (!pp) continue

                    const fade = fadeOf(pp.depth)
                    const ends = Math.min(1, Math.sin(u * Math.PI) * 2.4)
                    const alpha = (p.pipe ? 1 : 0.6) * fade * ends
                    if (alpha < 0.02) continue

                    const rad = (p.pipe ? 3.2 : 1.7) * pp.s
                    const tone = e.kind === "return" ? cool : glow

                    if (p.pipe) {
                        ctx.fillStyle = `rgba(${tone},${alpha * 0.14})`
                        ctx.beginPath()
                        ctx.arc(pp.sx, pp.sy, rad * 4.4, 0, Math.PI * 2)
                        ctx.fill()
                    }
                    ctx.fillStyle = `rgba(${tone},${alpha})`
                    ctx.beginPath()
                    ctx.arc(pp.sx, pp.sy, rad, 0, Math.PI * 2)
                    ctx.fill()
                }

                // ── Nodes, far to near ──
                const nOrder = nodes
                    .map((n, i) => ({ n, p: proj[i] }))
                    .filter((o): o is { n: Node; p: NonNullable<(typeof proj)[0]> } =>
                        o.p !== null
                    )
                    .sort((a, b) => b.p.depth - a.p.depth)

                for (let k = 0; k < nOrder.length; k++) {
                    const { n, p } = nOrder[k]
                    const fade = fadeOf(p.depth)
                    const s = n.size * p.s
                    const tone = n.tier === 0 ? glow : n.icon === "money" ? cool : ink
                    const alpha = (n.tier === 0 ? 0.9 : 0.62) * fade

                    // Arrival flash sits behind the icon.
                    if (n.pulse > 0.04) {
                        ctx.fillStyle = `rgba(${glow},${n.pulse * 0.16 * fade})`
                        ctx.beginPath()
                        ctx.arc(p.sx, p.sy, s * (2.2 + n.pulse * 2.4), 0, Math.PI * 2)
                        ctx.fill()
                    }

                    if (n.tier === 0) {
                        // Stations get a halo so the chain reads as the spine.
                        ctx.fillStyle = `rgba(${glow},${0.07 * fade})`
                        ctx.beginPath()
                        ctx.arc(p.sx, p.sy, s * 2.1, 0, Math.PI * 2)
                        ctx.fill()
                    }

                    if (n.icon === "doc") {
                        paintDoc(ctx, p.sx, p.sy, s, tone, alpha, alpha * 0.5)
                    } else {
                        paintMoney(ctx, p.sx, p.sy, s, tone, alpha)
                    }

                    // ── Label ──
                    ctx.textAlign = "center"
                    if (n.tier === 0 && fade > 0.34) {
                        const size = Math.round(11 * Math.min(Math.max(p.s, 0.8), 1.3))
                        ctx.font = `700 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
                        const ly = p.sy + s * 1.9 + size
                        const tw = ctx.measureText(n.label).width
                        // Knock out behind station names so they never fight
                        // the conduit passing underneath.
                        ctx.fillStyle = isDark
                            ? `rgba(12,14,18,${0.66 * fade})`
                            : `rgba(252,253,253,${0.72 * fade})`
                        ctx.fillRect(p.sx - tw / 2 - 7, ly - size + 1, tw + 14, size + 5)
                        ctx.fillStyle = `rgba(${glow},${0.95 * fade})`
                        ctx.fillText(n.label, p.sx, ly)
                        ctx.fillStyle = `rgba(${glow},${0.5 * fade})`
                        ctx.fillRect(p.sx - 10, ly + 4, 20, 1)
                    } else if (n.tier === 1 && fade > 0.5) {
                        const size = Math.round(9.5 * Math.min(Math.max(p.s, 0.85), 1.2))
                        const ly = p.sy + s * 1.75 + size
                        ctx.font = `500 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
                        ctx.fillStyle = `rgba(${ink},${0.62 * fade})`
                        ctx.fillText(n.label, p.sx, ly)
                        if (n.label2) {
                            // Continuation line reads slightly quieter so the
                            // pair still scans as one label, not two entries.
                            ctx.fillStyle = `rgba(${ink},${0.46 * fade})`
                            ctx.fillText(n.label2, p.sx, ly + size * 1.2)
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
