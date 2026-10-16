"use client"

import * as React from "react"
import Lenis from "lenis"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

/**
 * The scroll engine behind "The Ledger Machine".
 *
 * Lenis owns the scroll position (inertial, sub-pixel smooth); GSAP's
 * ticker drives it so ScrollTrigger and Lenis never fight over rAF.
 * One loop, one layout read per frame — this is what keeps pinned
 * scenes at 60fps instead of tearing.
 *
 * Respects prefers-reduced-motion: the whole thing no-ops and native
 * scroll takes over, while individual scenes fall back to static state.
 */

let registered = false

export function registerScrollPlugins() {
    if (registered || typeof window === "undefined") return
    gsap.registerPlugin(ScrollTrigger)
    registered = true
}

/** True when the visitor has asked the OS to reduce motion. */
export function prefersReducedMotion() {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
    React.useEffect(() => {
        registerScrollPlugins()

        if (prefersReducedMotion()) {
            // Native scroll; ScrollTrigger still works, just without inertia.
            ScrollTrigger.refresh()
            return
        }

        const lenis = new Lenis({
            duration: 1.05,
            // Exponential ease-out — fast pickup, long graceful settle.
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            // Touch devices keep native momentum; emulating it feels worse.
            syncTouch: false,
            wheelMultiplier: 1,
        })

        // Lenis tells ScrollTrigger where we are, every frame.
        lenis.on("scroll", ScrollTrigger.update)

        const raf = (time: number) => lenis.raf(time * 1000)
        gsap.ticker.add(raf)
        gsap.ticker.lagSmoothing(0)

        // Fonts and images settling can shift pin distances.
        const refresh = () => ScrollTrigger.refresh()
        window.addEventListener("load", refresh)
        const t = window.setTimeout(refresh, 600)

        return () => {
            window.clearTimeout(t)
            window.removeEventListener("load", refresh)
            gsap.ticker.remove(raf)
            lenis.destroy()
        }
    }, [])

    return <>{children}</>
}

/**
 * Canvas bootstrap shared by every scene: DPR-aware sizing, automatic
 * resize handling, and a draw loop that only runs while the canvas is
 * actually on screen. Offscreen scenes cost zero frames.
 */
export function useSceneCanvas(
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
    opts: { animate?: boolean } = {}
) {
    const { animate = true } = opts
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const drawRef = React.useRef(draw)
    drawRef.current = draw

    React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d", { alpha: true })
        if (!ctx) return

        let w = 0
        let h = 0
        let frame = 0
        let visible = true
        let start = performance.now()

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            // Cap DPR at 2 — beyond that the fill-rate cost outweighs any
            // perceptible sharpness gain on these soft, glowing scenes.
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            w = rect.width
            h = rect.height
            canvas.width = Math.round(w * dpr)
            canvas.height = Math.round(h * dpr)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)

        const io = new IntersectionObserver(
            ([entry]) => {
                visible = entry.isIntersecting
                if (visible && animate && !frame) loop(performance.now())
            },
            { rootMargin: "120px" }
        )
        io.observe(canvas)

        const loop = (now: number) => {
            frame = 0
            if (!visible) return
            ctx.clearRect(0, 0, w, h)
            drawRef.current(ctx, w, h, (now - start) / 1000)
            if (animate) frame = requestAnimationFrame(loop)
        }

        loop(performance.now())

        return () => {
            if (frame) cancelAnimationFrame(frame)
            ro.disconnect()
            io.disconnect()
        }
    }, [animate])

    return canvasRef
}

/** Reads the live theme so canvas scenes can pick ink vs. paper palettes. */
export function useIsDark() {
    const [dark, setDark] = React.useState(false)

    React.useEffect(() => {
        const el = document.documentElement
        const read = () => setDark(el.classList.contains("dark"))
        read()
        const mo = new MutationObserver(read)
        mo.observe(el, { attributes: true, attributeFilter: ["class"] })
        return () => mo.disconnect()
    }, [])

    return dark
}
