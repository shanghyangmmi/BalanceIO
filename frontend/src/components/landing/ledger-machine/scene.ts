import * as THREE from "three"
import { gsap } from "gsap"

import { drawCard, type CardSpec, type Fonts, type Palette } from "./paper"
import { makeCardGeometry, makeCardMaterial, makeLightRig } from "./rig"
import { bookYear, buildLedgerPages, buildStatements, buildVariants } from "./content"
import { BUTTON_LOCAL, DESK_Y, makeDesk, SCREEN_H } from "./desk"

/**
 * The hero scene: one transaction, from the click that enters it to the
 * statements it ends up in.
 *
 * It opens on a desk. Somebody posts a journal entry in BalanceIO, and
 * the paper comes out of the screen: the document splits into the two
 * sides that must agree, lands in the general ledger, throws off its tax,
 * and closes as the three primary statements. Each pass through picks a
 * different transaction - a sale, a purchase, a payroll run, a goods
 * issue, a depreciation charge - so the loop shows the range of the
 * ledger without ever putting more than one thing on screen.
 *
 * Motion is layered in three tiers, and keeping them apart is what stops
 * the scene looking mechanical:
 *
 *   1. GSAP drives each card's Group - the choreography.
 *   2. The render loop offsets the Mesh inside that Group - idle drift,
 *      so nothing is ever perfectly still.
 *   3. The camera carries a damped pointer parallax, position only. An
 *      earlier hero let the pointer drive yaw and pitch, which moved the
 *      horizon and made the model read as unstable. The horizon here
 *      never moves.
 */

export const ACTS = ["Transaction", "Journal", "Ledger", "Tax", "Report"] as const
export type Act = (typeof ACTS)[number]

const STACK_COUNT = 9

/**
 * Where the ledger pile sits on the desk.
 *
 * It used to be at x -1.42, z 0.62 - inside the laptop's own footprint,
 * which spans x ±1.41 and z -1.11..0.75, so the pile grew straight
 * through the machine. It also sat at DESK_Y + 0.03 while a sheet tilted
 * to -1.35 rad reaches 0.105 below its own centre, so the bottom of the
 * pile was buried 8cm under a desk that is supposed to be flat.
 *
 * Now it rests in front of the machine and to the right, at the height
 * where the lowest corner of the lowest sheet just touches the surface.
 */
const STACK_X = 0.95
const STACK_Y = DESK_Y + 0.012
const STACK_Z = 1.7
/**
 * Flat. Exactly flat.
 *
 * It was -1.35 rad, which is 12.6 degrees off the desk - enough to look
 * like the pile was sliding off a surface that is plainly level, and
 * enough that the lowest sheet's far corner had to be buried to keep the
 * near corner down. Paper on a flat desk lies flat; the only variation
 * that belongs is in-plane, where sheets are never quite squared up.
 */
const STACK_TILT = -Math.PI / 2
/** How proud each sheet sits above the one below. */
const SHEET_GAP = 0.016
/** The pile is set down at a slight angle to the desk edge, as piles are. */
const STACK_YAW = 0.14

/**
 * The world box the camera must always contain.
 *
 * This exists because the first version hard-coded the camera distance.
 * The stage is a column roughly 0.75 wide for every 1 tall, which at
 * fov 34 and z 5.5 showed about 2.1 world units across - while the cards
 * are 1.92 wide and were being thrown to x = ±1.3. Most of the
 * choreography played outside the frame, which is exactly what the
 * screenshot showed: fragments at the edges and a hole in the middle.
 *
 * Framing is now solved from the aspect ratio at every resize instead.
 */
/** Depth at which the widest choreography plays - the statement fan. */
const ACTION_Z = 1.2
/** Visible world size required at ACTION_Z. The fan spans 4.26; this
 *  leaves about a tenth of the frame as margin on the narrowest stage. */
const FRAME_W = 4.7
const FRAME_H = 3.4
const FOV = 38

interface Card {
  /**
   * Whether this card is part of the current beat at all.
   *
   * Kept separate from `group.visible`, which is now derived every frame
   * from this flag *and* the material's opacity. A card faded to zero
   * still writes depth - `depthWrite` defaults to true and three does not
   * turn it off for transparent materials - so an invisible card went on
   * occluding everything behind it. With an `alpha: true` renderer what
   * showed through the hole was the page background: a white card-shaped
   * blank in light mode, a black one in dark. Hiding the object outright
   * is the fix; disabling depthWrite instead would only trade it for
   * sorting artefacts between overlapping sheets.
   */
  active: boolean
  /** GSAP's target. Choreography only. */
  group: THREE.Group
  /** Idle drift lives here so it never fights the timeline. */
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  texture?: THREE.CanvasTexture
  phase: number
}

export interface SceneOptions {
  canvas: HTMLCanvasElement
  host: HTMLElement
  palette: Palette
  fonts: Fonts
  reducedMotion: boolean
  onAct: (act: number) => void
}

export function createLedgerScene(opts: SceneOptions) {
  const { canvas, host, palette, fonts, reducedMotion, onAct } = opts

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  })
  // 1.5 rather than 2. This is a full-bleed canvas, so every extra tenth
  // of DPR is a few hundred thousand more shaded pixels, and the scene is
  // soft-lit paper - there is no fine detail that a 2x buffer preserves.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  // Shadow mapping is the biggest per-frame cost here and a phone gains
  // least from it. Narrow viewports go without.
  const shadows = window.innerWidth >= 768
  renderer.shadowMap.enabled = shadows
  // PCF rather than PCFSoft. Soft does several extra taps per shadowed
  // fragment, and the desk plane covers most of the frame - that filter
  // was being paid for across nearly every pixel on screen.
  renderer.shadowMap.type = THREE.PCFShadowMap
  // Nothing that casts a shadow ever moves: the desk, the machine and the
  // props are fixed, and the cards are deliberately excluded below. So
  // the shadow map is rendered once instead of re-rendering the whole
  // scene from the light every single frame.
  renderer.shadowMap.autoUpdate = false

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(new THREE.Color(palette.background), 7, 15)

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  /** Content-relative aim. The pan below is added on top of it. */
  const lookTarget = new THREE.Vector3(0, -0.34, 0)
  const aim = new THREE.Vector3()
  /** Solved on resize; the dolly rides on top of it. */
  let baseZ = 6
  /**
   * Horizontal pan. Full bleed means the type column sits over the left
   * of the render, so the choreography is pushed right of centre by
   * panning the camera left. Only on stages wide enough to have a left
   * column at all.
   */
  let panX = 0
  const dolly = { value: 0.85 }

  const rig = makeLightRig(palette)
  // The desk receives the shadows now, so the invisible catcher plane
  // would only double them up.
  rig.floor.visible = false
  scene.add(rig.group)

  const desk = makeDesk(palette, fonts, shadows)
  scene.add(desk.group)

  // Every date on every card derives from one financial year, resolved
  // here at runtime rather than baked at build time - so the page still
  // reads correctly next January without an edit.
  const year = bookYear()
  const variants = buildVariants(year)
  const ledgerPages = buildLedgerPages(year)
  const statementSpecs = buildStatements(year)

  const geometry = makeCardGeometry()
  const disposables: { dispose(): void }[] = [geometry]

  let phaseSeed = 0
  function makeCard(order: number): Card {
    const material = makeCardMaterial(null)
    const mesh = new THREE.Mesh(geometry, material)
    // Cards neither cast nor receive. Casting would bake a moving sheet
    // into a static shadow map; receiving would put shadow sampling in
    // the shader of the objects that cover the most screen, for a
    // contribution nobody would notice on a sheet held in mid-air.
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.renderOrder = order

    const group = new THREE.Group()
    group.add(mesh)
    group.visible = false
    scene.add(group)

    disposables.push(material)
    return { active: false, group, mesh, material, phase: (phaseSeed += 1.7) }
  }

  // ── the cast ──────────────────────────────────────────────────────

  // The pile is made of real general ledger pages. It used to be blank
  // ruled paper, which read as a rendering fault the moment the camera
  // came close - correctly, because a blank general ledger is a fault.
  const ledgerTextures = ledgerPages.map((spec) => drawCard(spec, palette, fonts))
  disposables.push(...ledgerTextures)

  const stack: Card[] = []
  for (let i = 0; i < STACK_COUNT; i++) {
    const card = makeCard(10 + i)
    card.material.map = ledgerTextures[i % ledgerTextures.length]
    card.material.needsUpdate = true
    card.active = true
    stack.push(card)
  }

  const doc = makeCard(40)
  const debit = makeCard(41)
  const credit = makeCard(42)
  const tax = makeCard(43)

  // Three statements, not one. "See the report" means the primary set.
  const statements = statementSpecs.map((spec, i) => {
    const card = makeCard(50 + i)
    card.texture = drawCard(spec, palette, fonts)
    card.material.map = card.texture
    card.material.needsUpdate = true
    return card
  })
  const [soci, sofp, socf] = statements

  /**
   * Every variant's card faces, built once and kept.
   *
   * They used to be drawn at the moment the loop rolled over, which meant
   * four fresh 1024x640 textures - about 10MB - were created and uploaded
   * to the GPU inside a single frame, every 17.7 seconds. That is not a
   * frame rate problem, it is a hitch, and it is what "not smooth" felt
   * like.
   *
   * The first variant is built immediately because it is on screen; the
   * rest are built one per tick afterwards, so the cost lands while the
   * hero is still fading in rather than all at once.
   */
  interface VariantTextures {
    doc: THREE.CanvasTexture
    debit: THREE.CanvasTexture
    credit: THREE.CanvasTexture
    tax: THREE.CanvasTexture | null
  }

  const variantTextures: (VariantTextures | undefined)[] = variants.map(() => undefined)

  const buildVariant = (index: number): VariantTextures => {
    const v = variants[index]
    return {
      doc: drawCard(v.doc, palette, fonts),
      debit: drawCard(v.debit, palette, fonts),
      credit: drawCard(v.credit, palette, fonts),
      tax: v.tax ? drawCard(v.tax, palette, fonts) : null,
    }
  }

  const ensureVariant = (index: number): VariantTextures => {
    const existing = variantTextures[index]
    if (existing) return existing
    const built = buildVariant(index)
    variantTextures[index] = built
    return built
  }

  let variantIndex = 0
  function loadVariant(index: number) {
    const t = ensureVariant(index % variants.length)
    const assign = (card: Card, texture: THREE.CanvasTexture | null) => {
      card.material.map = texture
      card.material.needsUpdate = true
    }
    assign(doc, t.doc)
    assign(debit, t.debit)
    assign(credit, t.credit)
    assign(tax, t.tax)
  }
  loadVariant(0)

  // Warm the remaining variants off the critical path.
  let warmIndex = 1
  let warmTimer: ReturnType<typeof setTimeout> | undefined
  const warmNext = () => {
    if (warmIndex >= variants.length) return
    ensureVariant(warmIndex++)
    warmTimer = setTimeout(warmNext, 140)
  }
  warmTimer = setTimeout(warmNext, 500)

  // ── staging ───────────────────────────────────────────────────────

  const place = (c: Card, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1) => {
    c.group.position.set(x, y, z)
    c.group.rotation.set(rx, ry, rz)
    c.group.scale.setScalar(s)
  }

  const born = desk.screenAnchor

  function resetStage() {
    // Everything starts inside the screen.
    for (const card of [doc, debit, credit, tax, ...statements]) {
      place(card, born.x, born.y, born.z, -0.34, 0, 0, 0.34)
      card.material.opacity = 0
      card.active = false
    }

    stack.forEach((card, i) => {
      card.active = true
      place(
        card,
        STACK_X,
        STACK_Y + i * SHEET_GAP,
        STACK_Z,
        STACK_TILT,
        0,
        // Flat, so this rotation is purely in the plane of the desk -
        // the way sheets in a real pile sit slightly out of square.
        STACK_YAW + ((i % 3) - 1) * 0.028,
        0.74,
      )
      card.material.opacity = 0
    })

    desk.setPressed(false)
    desk.cursorMaterial.opacity = 0
    desk.cursor.position.set(0.72, SCREEN_H / 2 + 0.06 - 0.34, 0.02)

    dolly.value = 0.85
    lookTarget.set(0, -0.34, 0)
  }

  resetStage()

  // ── choreography ──────────────────────────────────────────────────

  const show = (card: Card) => {
    card.active = true
  }

  const timeline = gsap.timeline({
    repeat: -1,
    paused: true,
    defaults: { ease: "power3.out" },
    onRepeat: () => {
      variantIndex = (variantIndex + 1) % variants.length
      loadVariant(variantIndex)
      resetStage()
    },
  })

  const SETTLE = "power4.out"
  /** Overshoot on landings. Restrained: paper has weight, not bounce. */
  const LAND = "back.out(1.15)"

  // ── Act I: somebody posts the entry, and the paper comes out ──────
  const cursorTargetY = SCREEN_H / 2 + 0.06 + BUTTON_LOCAL.y

  timeline
    .call(() => {
      onAct(0)
      desk.setPressed(false)
    })
    .to(desk.cursorMaterial, { opacity: 1, duration: 0.4 }, 0.25)
    .to(
      desk.cursor.position,
      { x: BUTTON_LOCAL.x + 0.05, y: cursorTargetY, duration: 1.1, ease: "power2.inOut" },
      0.3,
    )
    // The click itself.
    .call(() => desk.setPressed(true), undefined, 1.45)
    .to(desk.cursor.scale, { x: 0.82, y: 0.82, duration: 0.09 }, 1.45)
    .to(desk.cursor.scale, { x: 1, y: 1, duration: 0.16 }, 1.54)
    .call(() => desk.setPressed(false), undefined, 1.72)
    .to(desk.cursorMaterial, { opacity: 0, duration: 0.5 }, 1.95)

  // The document is extruded out of the display.
  timeline
    .call(() => show(doc), undefined, 1.62)
    .to(doc.material, { opacity: 1, duration: 0.5 }, 1.62)
    .to(
      doc.group.position,
      { x: 0.42, y: 0.24, z: 1.05, duration: 1.75, ease: SETTLE },
      1.62,
    )
    .to(doc.group.rotation, { x: 0, y: -0.16, z: 0, duration: 1.8, ease: SETTLE }, 1.62)
    .to(doc.group.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 1.6, ease: LAND }, 1.62)

  // ── Act II: it is booked ──────────────────────────────────────────
  // The document opens like a folded sheet. The two sides separate, then
  // level onto a common baseline - that levelling is the whole argument
  // of the product, so it gets its own beat.
  const AT_II = 4.1
  timeline
    .call(
      () => {
        onAct(1)
        show(debit)
        show(credit)
      },
      undefined,
      AT_II,
    )
    .set(debit.group.position, { x: 0.42, y: 0.24, z: 1.02 }, AT_II)
    .set(credit.group.position, { x: 0.42, y: 0.24, z: 1.02 }, AT_II)
    .set(debit.group.rotation, { x: 0, y: -0.16, z: 0 }, AT_II)
    .set(credit.group.rotation, { x: 0, y: -0.16, z: 0 }, AT_II)
    .set(debit.group.scale, { x: 0.9, y: 0.9, z: 0.9 }, AT_II)
    .set(credit.group.scale, { x: 0.9, y: 0.9, z: 0.9 }, AT_II)
    .to(doc.material, { opacity: 0, duration: 0.5 }, AT_II)
    .to(doc.group.scale, { x: 0.84, y: 0.84, z: 0.84, duration: 0.5 }, AT_II)
    .to(debit.group.position, { x: -1.02, y: 0.42, z: 1.1, duration: 1.4, ease: SETTLE }, AT_II + 0.06)
    .to(credit.group.position, { x: 1.02, y: -0.18, z: 1.1, duration: 1.4, ease: SETTLE }, AT_II + 0.06)
    .to(debit.group.rotation, { y: 0.3, z: 0.035, duration: 1.4, ease: SETTLE }, AT_II + 0.06)
    .to(credit.group.rotation, { y: -0.3, z: -0.035, duration: 1.4, ease: SETTLE }, AT_II + 0.06)
    .to(debit.material, { opacity: 1, duration: 0.55 }, AT_II + 0.06)
    .to(credit.material, { opacity: 1, duration: 0.55 }, AT_II + 0.06)
    // Dr = Cr. Both sides come to rest at exactly the same height.
    .to(debit.group.position, { y: 0.14, duration: 1.05, ease: "power2.inOut" }, AT_II + 1.6)
    .to(credit.group.position, { y: 0.14, duration: 1.05, ease: "power2.inOut" }, AT_II + 1.6)
    .to(debit.group.rotation, { z: 0, duration: 1.05, ease: "power2.inOut" }, AT_II + 1.6)
    .to(credit.group.rotation, { z: 0, duration: 1.05, ease: "power2.inOut" }, AT_II + 1.6)

  // ── Act III: it lands in the ledger ───────────────────────────────
  const AT_III = 7.4
  timeline
    .call(() => onAct(2), undefined, AT_III)
    .to(
      debit.group.position,
      { x: STACK_X, y: STACK_Y + 0.34, z: STACK_Z, duration: 1.2, ease: "power2.in" },
      AT_III,
    )
    .to(
      credit.group.position,
      { x: STACK_X, y: STACK_Y + 0.34, z: STACK_Z, duration: 1.2, ease: "power2.in" },
      AT_III + 0.12,
    )
    .to(debit.group.rotation, { x: STACK_TILT, y: 0, z: STACK_YAW, duration: 1.2 }, AT_III)
    .to(credit.group.rotation, { x: STACK_TILT, y: 0, z: STACK_YAW, duration: 1.2 }, AT_III + 0.12)
    .to(debit.group.scale, { x: 0.74, y: 0.74, z: 0.74, duration: 1.2 }, AT_III)
    .to(credit.group.scale, { x: 0.74, y: 0.74, z: 0.74, duration: 1.2 }, AT_III + 0.12)
    .to(debit.material, { opacity: 0, duration: 0.4 }, AT_III + 0.88)
    .to(credit.material, { opacity: 0, duration: 0.4 }, AT_III + 1.0)

  stack.forEach((card, i) => {
    const at = AT_III + 0.2 + i * 0.05
    timeline
      .to(card.material, { opacity: 1, duration: 0.45 }, at)
      .fromTo(
        card.group.position,
        { y: STACK_Y + i * SHEET_GAP - 0.3 },
        { y: STACK_Y + i * SHEET_GAP, duration: 0.8, ease: LAND },
        at,
      )
      .fromTo(
        card.group.rotation,
        { z: STACK_YAW + ((i % 3) - 1) * 0.028 - 0.06 },
        { z: STACK_YAW + ((i % 3) - 1) * 0.028, duration: 0.9, ease: SETTLE },
        at,
      )
  })

  // ── Act IV: the tax falls out of what was just posted ─────────────
  const AT_IV = 9.7
  timeline
    .call(
      () => {
        onAct(3)
        if (tax.material.map) show(tax)
      },
      undefined,
      AT_IV,
    )
    .set(tax.group.position, { x: STACK_X, y: STACK_Y + 0.3, z: STACK_Z }, AT_IV)
    .set(tax.group.rotation, { x: STACK_TILT, y: 0, z: STACK_YAW }, AT_IV)
    .set(tax.group.scale, { x: 0.74, y: 0.74, z: 0.74 }, AT_IV)
    .to(tax.material, { opacity: 1, duration: 0.55 }, AT_IV + 0.04)
    // Peeled off the pile at an angle first, then turned to face.
    .to(tax.group.position, { x: 1.1, y: 0.3, z: 1.15, duration: 1.5, ease: SETTLE }, AT_IV + 0.06)
    .to(tax.group.rotation, { x: 0, y: -0.32, z: -0.04, duration: 1.5, ease: SETTLE }, AT_IV + 0.06)
    .to(tax.group.scale, { x: 0.82, y: 0.82, z: 0.82, duration: 1.5, ease: LAND }, AT_IV + 0.06)

  // ── Act V: the statements ─────────────────────────────────────────
  const AT_V = 12.1
  const fan: [Card, number, number, number, number][] = [
    // card, x, y, rotY, scale
    [soci, -1.36, 0.44, 0.34, 0.8],
    [sofp, 0, 0.12, 0, 0.94],
    [socf, 1.36, 0.44, -0.34, 0.8],
  ]

  timeline
    .call(
      () => {
        onAct(4)
        for (const card of statements) show(card)
      },
      undefined,
      AT_V,
    )
    .to(tax.material, { opacity: 0, duration: 0.6 }, AT_V)
    .to(tax.group.position, { x: 2.0, y: 0.5, duration: 0.9 }, AT_V)

  fan.forEach(([card, x, y, ry, s], i) => {
    const at = AT_V + 0.08 + i * 0.14
    timeline
      .set(card.group.position, { x: STACK_X, y: STACK_Y + 0.34, z: STACK_Z }, AT_V)
      .set(card.group.rotation, { x: STACK_TILT, y: 0, z: STACK_YAW }, AT_V)
      .set(card.group.scale, { x: 0.74, y: 0.74, z: 0.74 }, AT_V)
      .to(card.material, { opacity: 1, duration: 0.7 }, at)
      .to(card.group.position, { x, y, z: 1.2, duration: 1.7, ease: SETTLE }, at)
      .to(card.group.rotation, { x: 0, y: ry, z: 0, duration: 1.7, ease: SETTLE }, at)
      .to(card.group.scale, { x: s, y: s, z: s, duration: 1.7, ease: LAND }, at)
  })

  timeline.to(stack.map((c) => c.material), { opacity: 0.3, duration: 1.1, stagger: 0.02 }, AT_V + 0.4)

  // Close out, so the loop restarts from a clean desk rather than cutting.
  const AT_END = 16.2
  timeline
    .to(statements.map((c) => c.material), { opacity: 0, duration: 0.85, stagger: 0.06 }, AT_END)
    .to(sofp.group.position, { z: 1.9, y: 0.35, duration: 1.1 }, AT_END)
    .to(stack.map((c) => c.material), { opacity: 0, duration: 0.8, stagger: 0.015 }, AT_END)
    .to({}, { duration: 0.5 }, AT_END + 1.0)

  // The camera is directed. It starts in on the machine, pulls back as
  // the paper leaves the screen, and reframes for the act that is
  // playing. It never orbits.
  timeline
    .to(dolly, { value: 0.42, duration: 2.2, ease: "power2.inOut" }, 1.5)
    .to(dolly, { value: 0.12, duration: 2.0, ease: "power2.inOut" }, AT_II)
    .to(dolly, { value: 0, duration: 2.0, ease: "power2.inOut" }, AT_V)
    .to(lookTarget, { y: -0.12, duration: 1.6 }, 1.6)
    .to(lookTarget, { x: -0.06, y: 0.02, duration: 1.5 }, AT_II)
    .to(lookTarget, { x: -0.3, y: -0.34, duration: 1.6 }, AT_III)
    .to(lookTarget, { x: 0.16, y: -0.06, duration: 1.5 }, AT_IV)
    .to(lookTarget, { x: 0, y: 0.06, duration: 1.7 }, AT_V)

  // ── pointer parallax ──────────────────────────────────────────────

  const pointer = { x: 0, y: 0 }
  const pointerTarget = { x: 0, y: 0 }

  const onPointerMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect()
    pointerTarget.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    pointerTarget.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
  }
  const onPointerLeave = () => {
    pointerTarget.x = 0
    pointerTarget.y = 0
  }
  if (!reducedMotion) {
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    host.addEventListener("pointerleave", onPointerLeave)
  }

  // ── framing ───────────────────────────────────────────────────────

  const resize = () => {
    const rect = host.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    renderer.setSize(width, height, false)

    const aspect = width / height
    camera.aspect = aspect
    camera.updateProjectionMatrix()

    // Solve for the distance that contains the whole staging box in both
    // axes, so a portrait column pulls back instead of cropping.
    // Solved at ACTION_Z rather than at the origin. Fitting at the
    // origin under-counts: the cards sit closer to the lens than the
    // plane being fitted, so they render larger than the solve assumed
    // and clip anyway.
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)

    // A panned camera has to frame the pan as well as the action, or the
    // far side of the choreography leaves the screen.
    panX = aspect >= 1.4 ? -0.95 : 0
    const frameW = FRAME_W + Math.abs(panX) * 2

    const forWidth = frameW / 2 / (halfTan * aspect)
    const forHeight = FRAME_H / 2 / halfTan
    baseZ = Math.max(forWidth, forHeight) + ACTION_Z
  }

  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  // ── render loop ───────────────────────────────────────────────────

  const allCards = [doc, debit, credit, tax, ...statements, ...stack]
  let last = performance.now()
  let shadowsPending = shadows

  const render = () => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const t = now / 1000

    // Tier 2: idle drift on the mesh inside each group. Amplitudes are
    // tiny - enough that nothing is frozen, not enough to read as a
    // separate animation.
    for (const card of allCards) {
      // Derived, not set by the choreography: a card is drawn only while
      // it is both in play and actually carrying opacity.
      card.group.visible = card.active && card.material.opacity > 0.004
      if (!card.group.visible) continue

      // Hiding zero-opacity cards was only half the fix. A card caught
      // mid-fade - say 0.4 through the split in Act II - is still drawn
      // and still writes depth, so it goes on punching a hole in whatever
      // is behind it while being see-through itself. Depth is written
      // only while a sheet is genuinely opaque; part-faded sheets layer
      // by renderOrder instead, which is assigned per card anyway.
      card.material.depthWrite = card.material.opacity > 0.995
      card.mesh.position.y = Math.sin(t * 0.8 + card.phase) * 0.011
      card.mesh.rotation.z = Math.sin(t * 0.62 + card.phase) * 0.0055
      card.mesh.rotation.x = Math.cos(t * 0.54 + card.phase) * 0.004
    }

    // Tier 3: damped pointer parallax, position only.
    pointer.x += (pointerTarget.x - pointer.x) * Math.min(dt * 3.2, 1)
    pointer.y += (pointerTarget.y - pointer.y) * Math.min(dt * 3.2, 1)
    camera.position.set(
      panX + pointer.x * 0.16,
      0.26 - pointer.y * 0.09,
      baseZ + dolly.value,
    )
    // Pan translates the view; it never rotates it, so the horizon stays
    // where it is.
    aim.copy(lookTarget)
    aim.x += panX
    camera.lookAt(aim)

    renderer.render(scene, camera)

    // The shadow map is baked on the first frame and then left alone.
    // Everything that casts into it is static.
    if (shadowsPending) {
      shadowsPending = false
      renderer.shadowMap.needsUpdate = true
    }
  }

  let running = false
  const start = () => {
    if (running) return
    running = true
    last = performance.now()
    gsap.ticker.add(render)
    timeline.play()
  }
  const stop = () => {
    if (!running) return
    running = false
    gsap.ticker.remove(render)
    timeline.pause()
  }

  // A meaningful static end state, not a blank box: the three statements
  // settled on the desk.
  if (reducedMotion) {
    onAct(4)
    timeline.progress((AT_V + 2.2) / timeline.duration())
    timeline.pause()
    render()
  }

  // Offscreen scenes cost zero frames.
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (reducedMotion) return
      if (entry.isIntersecting) start()
      else stop()
    },
    { rootMargin: "80px" },
  )
  observer.observe(host)

  return {
    dispose() {
      stop()
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerleave", onPointerLeave)
      timeline.kill()
      if (warmTimer) clearTimeout(warmTimer)
      for (const set of variantTextures) {
        if (!set) continue
        set.doc.dispose()
        set.debit.dispose()
        set.credit.dispose()
        set.tax?.dispose()
      }
      for (const card of statements) card.texture?.dispose()
      for (const d of disposables) d.dispose()
      desk.dispose()
      rig.dispose()
      renderer.dispose()
    },
  }
}
