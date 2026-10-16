import * as THREE from "three"

import type { Fonts, Palette } from "./paper"
import { makePlant } from "./plant"

/**
 * The desk the whole scene sits on.
 *
 * The brief was to make the opening read like somebody's actual desk
 * rather than paper floating in a void, and the risk in that is obvious:
 * hand-built office props made of boxes look like a budget game asset,
 * which would cost more credibility than the void ever did.
 *
 * So the restraint is deliberate. A surface, a machine, a cursor. No mug,
 * no plant, no stationery. Everything here is either something the
 * software runs on or something the user touches.
 *
 * What sells it is not the modelling, it is that the screen emits light
 * instead of reflecting it, and that the shell is rounded rather than
 * cut from raw boxes.
 */

export const SCREEN_W = 2.72
export const SCREEN_H = 1.7
const BASE_D = 1.86
const SHELL_R = 0.055

/** Desk height. Everything else is measured from here. */
export const DESK_Y = -1.36
/** Lid tilt from vertical - a comfortable working angle, not fully open. */
const LID_TILT = -0.34

const BEVEL = 0.012

/**
 * A rounded slab, so the shell never reads as a raw box.
 *
 * Returns its half-depth alongside the geometry, and that return value is
 * not decoration. ExtrudeGeometry adds `bevelThickness` at *both* ends, so
 * a slab asked for 0.05 deep is really 0.074 - and `center()` then splits
 * that larger figure. Placing a screen 2mm in front of where the shell was
 * assumed to end put it 9mm inside the shell instead, which is why the
 * laptop rendered as a blank grey slab with no display on it.
 */
function slab(w: number, h: number, depth: number, r: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2 + r, -h / 2)
  shape.lineTo(w / 2 - r, -h / 2)
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  shape.lineTo(w / 2, h / 2 - r)
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  shape.lineTo(-w / 2 + r, h / 2)
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  shape.lineTo(-w / 2, -h / 2 + r)
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 8,
  })
  geometry.center()
  return { geometry, halfDepth: (depth + BEVEL * 2) / 2 }
}

/**
 * The product, on the screen. Drawn rather than imported so it tracks the
 * theme, and so the thing the visitor sees running is recognisably the
 * module hub they will land on after signing in.
 */
function drawScreen(p: Palette, f: Fonts, pressed: boolean): THREE.CanvasTexture {
  const W = 1360
  const H = 850
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  ctx.fillStyle = p.background
  ctx.fillRect(0, 0, W, H)

  // Sidebar
  ctx.fillStyle = p.isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.022)"
  ctx.fillRect(0, 0, 232, H)
  ctx.fillStyle = p.line
  ctx.fillRect(232, 0, 2, H)

  ctx.fillStyle = p.accent
  ctx.beginPath()
  ctx.arc(58, 62, 13, 0, Math.PI * 2)
  ctx.fill()

  ctx.font = `700 30px ${f.sans}`
  ctx.fillStyle = p.ink
  ctx.textBaseline = "middle"
  ctx.fillText("BalanceIO", 84, 62)

  const nav = ["Dashboard", "Accounting", "Tax", "Inventory", "Fixed Assets", "Reports"]
  ctx.font = `500 22px ${f.sans}`
  nav.forEach((label, i) => {
    const y = 150 + i * 52
    if (i === 0) {
      ctx.fillStyle = p.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
      ctx.fillRect(16, y - 20, 200, 40)
    }
    ctx.fillStyle = i === 0 ? p.ink : p.muted
    ctx.fillText(label, 40, y)
  })

  // Header
  ctx.font = `600 20px ${f.mono}`
  ctx.letterSpacing = "5px"
  ctx.fillStyle = p.muted
  ctx.fillText("MODULE HUB", 282, 60)
  ctx.letterSpacing = "0px"

  ctx.font = `700 40px ${f.sans}`
  ctx.fillStyle = p.ink
  ctx.fillText("Every figure accounted for", 282, 116)

  ctx.fillStyle = p.line
  ctx.fillRect(282, 156, W - 282 - 56, 2)

  // Module tiles, coloured the way the real hub colours them.
  const tiles: [string, string, string][] = [
    ["Accounting", "Debits equal credits", p.accent],
    ["Tax", "PPN due in 6 days", p.isDark ? "rgb(251,191,36)" : "rgb(180,83,9)"],
    ["Inventory", "1 item negative", p.isDark ? "rgb(248,113,113)" : "rgb(185,28,28)"],
    ["Fixed Assets", "Depreciation due", p.isDark ? "rgb(251,191,36)" : "rgb(180,83,9)"],
  ]
  tiles.forEach((tile, i) => {
    const x = 282 + (i % 2) * 396
    const y = 196 + Math.floor(i / 2) * 168
    ctx.strokeStyle = p.line
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, 364, 136)
    ctx.fillStyle = tile[2]
    ctx.fillRect(x, y, 364, 3)

    ctx.font = `600 16px ${f.mono}`
    ctx.letterSpacing = "3px"
    ctx.fillStyle = p.muted
    ctx.fillText(tile[0].toUpperCase(), x + 26, y + 40)
    ctx.letterSpacing = "0px"

    ctx.font = `600 25px ${f.sans}`
    ctx.fillStyle = p.ink
    ctx.fillText(tile[1], x + 26, y + 82)

    ctx.beginPath()
    ctx.arc(x + 338, y + 40, 7, 0, Math.PI * 2)
    ctx.fillStyle = tile[2]
    ctx.fill()
  })

  // The control the cursor presses. Pressed state is a separate texture,
  // swapped on the click frame, which is cheaper and crisper than
  // animating a mesh.
  const bx = 282
  const by = 560
  ctx.fillStyle = pressed ? p.secondary : p.accent
  const bw = 292
  const bh = 62
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 12)
  ctx.fill()

  ctx.font = `600 25px ${f.sans}`
  ctx.fillStyle = p.isDark ? "rgb(8,20,18)" : "rgb(255,255,255)"
  ctx.textAlign = "center"
  ctx.fillText("Post journal entry", bx + bw / 2, by + bh / 2 + 1)
  ctx.textAlign = "left"

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** Standard arrow pointer, drawn once. */
function drawCursor(p: Palette): THREE.CanvasTexture {
  const S = 128
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = S
  const ctx = canvas.getContext("2d")!

  ctx.beginPath()
  ctx.moveTo(18, 12)
  ctx.lineTo(18, 96)
  ctx.lineTo(40, 76)
  ctx.lineTo(54, 108)
  ctx.lineTo(70, 100)
  ctx.lineTo(56, 70)
  ctx.lineTo(84, 68)
  ctx.closePath()
  ctx.fillStyle = p.isDark ? "rgb(250,250,250)" : "rgb(20,24,31)"
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = p.isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)"
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export interface Desk {
  group: THREE.Group
  /** Where a document is born: the centre of the screen, in world space. */
  screenAnchor: THREE.Vector3
  cursor: THREE.Mesh
  cursorMaterial: THREE.MeshBasicMaterial
  /** Swaps the button to its pressed state for the click frame. */
  setPressed(pressed: boolean): void
  dispose(): void
}

export function makeDesk(palette: Palette, fonts: Fonts, shadows: boolean): Desk {
  const group = new THREE.Group()
  const disposables: { dispose(): void }[] = []

  // ── Room ──────────────────────────────────────────────────────────
  // Two planes and the fog do the whole job. The brief asked where the
  // office was; the answer is not to model one - it is to give the eye a
  // floor, a wall, and the seam between them, and let the fog dissolve
  // both before they reach an edge.
  const surfaceGeometry = new THREE.PlaneGeometry(48, 30)
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x12161d : 0xe4ebe7),
    roughness: 0.94,
    metalness: 0,
  })
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)
  surface.rotation.x = -Math.PI / 2
  surface.position.set(0, DESK_Y, -4)
  surface.receiveShadow = shadows
  group.add(surface)
  disposables.push(surfaceGeometry, surfaceMaterial)

  const wallGeometry = new THREE.PlaneGeometry(48, 26)
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x171c25 : 0xeef3f0),
    roughness: 1,
    metalness: 0,
  })
  const wall = new THREE.Mesh(wallGeometry, wallMaterial)
  wall.position.set(0, DESK_Y + 13, -9)
  group.add(wall)
  disposables.push(wallGeometry, wallMaterial)

  // ── Machine ───────────────────────────────────────────────────────
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x2b323c : 0xc9d2d0),
    roughness: 0.38,
    metalness: 0.62,
  })
  disposables.push(shellMaterial)

  const baseSlab = slab(SCREEN_W + 0.1, BASE_D, 0.072, SHELL_R)
  const base = new THREE.Mesh(baseSlab.geometry, shellMaterial)
  base.rotation.x = -Math.PI / 2
  // Rotated flat, the slab's depth becomes its height, so its underside
  // sits on the desk exactly at DESK_Y + halfDepth.
  base.position.set(0, DESK_Y + baseSlab.halfDepth, -0.18)
  base.castShadow = shadows
  base.receiveShadow = shadows
  group.add(base)
  disposables.push(baseSlab.geometry)

  // Keyboard well: a darker inset, not modelled keys. Keys at this scale
  // would read as noise. Sits 2mm proud of the base's real top face.
  const wellGeometry = new THREE.PlaneGeometry(SCREEN_W - 0.42, BASE_D - 0.62)
  const wellMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x171c24 : 0xa9b4b1),
    roughness: 0.85,
    metalness: 0.1,
  })
  const well = new THREE.Mesh(wellGeometry, wellMaterial)
  well.rotation.x = -Math.PI / 2
  well.position.set(0, DESK_Y + baseSlab.halfDepth * 2 + 0.002, -0.28)
  group.add(well)
  disposables.push(wellGeometry, wellMaterial)

  // Lid, hinged at the back edge of the base.
  const lid = new THREE.Group()
  lid.position.set(0, DESK_Y + baseSlab.halfDepth * 2, -1.08)
  lid.rotation.x = LID_TILT
  group.add(lid)

  const LID_Y = (SCREEN_H + 0.12) / 2
  const lidSlab = slab(SCREEN_W + 0.1, SCREEN_H + 0.12, 0.05, SHELL_R)
  const lidShell = new THREE.Mesh(lidSlab.geometry, shellMaterial)
  // Front face lands exactly on z = 0, so the screen can sit just proud
  // of it instead of being buried inside.
  lidShell.position.set(0, LID_Y, -lidSlab.halfDepth)
  lidShell.castShadow = shadows
  lid.add(lidShell)
  disposables.push(lidSlab.geometry)

  // ── Screen ────────────────────────────────────────────────────────
  // Emissive, not lit. A display that merely reflects the room reads as
  // a dead panel; making it emit is the single detail that makes the
  // machine look switched on.
  const screenTexture = drawScreen(palette, fonts, false)
  const pressedTexture = drawScreen(palette, fonts, true)
  const screenMaterial = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: screenTexture,
    emissiveIntensity: palette.isDark ? 0.92 : 0.78,
    roughness: 0.28,
    metalness: 0,
  })
  const screenGeometry = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H)
  const screen = new THREE.Mesh(screenGeometry, screenMaterial)
  screen.position.set(0, LID_Y, 0.004)
  lid.add(screen)
  disposables.push(screenGeometry, screenMaterial, screenTexture, pressedTexture)

  // ── Cursor ────────────────────────────────────────────────────────
  const cursorTexture = drawCursor(palette)
  const cursorMaterial = new THREE.MeshBasicMaterial({
    map: cursorTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  })
  const cursorGeometry = new THREE.PlaneGeometry(0.15, 0.15)
  const cursor = new THREE.Mesh(cursorGeometry, cursorMaterial)
  cursor.renderOrder = 60
  cursor.position.set(0.6, LID_Y - 0.2, 0.02)
  lid.add(cursor)
  disposables.push(cursorGeometry, cursorMaterial, cursorTexture)

  // ── Desk accessories ──────────────────────────────────────────────
  //
  // Sized against the machine rather than by eye. BASE_D is 1.86 units
  // for a 14" laptop's 22cm depth, which fixes the scale at roughly
  // 11.8cm per unit - and by that measure the first attempt gave the desk
  // a 3cm mug and 2mm pens. Everything below is derived from a real
  // dimension instead.
  //
  // Placed by constraint too: the laptop occupies x ±1.41, z -1.11..0.75
  // and the ledger pile sits at x 0.95, z 1.7, so nothing may land in
  // either footprint.
  //
  // Turned forms only - a lathe and some cylinders. Boxes would read as
  // low-poly filler next to a machined shell.
  const ceramic = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x323a45 : 0xf2f5f3),
    roughness: 0.34,
    metalness: 0.02,
  })
  const darkTrim = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x1b212a : 0x8d9a96),
    roughness: 0.6,
    metalness: 0.08,
  })
  disposables.push(ceramic, darkTrim)

  /**
   * Adds a prop, choosing what it takes part in.
   *
   * Every object was casting *and* receiving shadows, which doubled the
   * shadow pass for things whose shadow nobody can see - a 0.8cm pen
   * contributes nothing to a 1024px shadow map but costs a full extra
   * draw. Only objects with real mass cast; only broad flat surfaces
   * receive.
   */
  const prop = (
    mesh: THREE.Mesh,
    opts: { cast?: boolean; receive?: boolean } = {},
  ) => {
    mesh.castShadow = shadows && (opts.cast ?? true)
    mesh.receiveShadow = shadows && (opts.receive ?? false)
    group.add(mesh)
    return mesh
  }

  // Mug: 8.5cm across, 9.4cm tall.
  const MUG = { x: 1.95, z: 0.35, r: 0.36, h: 0.8 }
  const mugGeometry = new THREE.CylinderGeometry(MUG.r, MUG.r * 0.88, MUG.h, 40)
  const mug = prop(new THREE.Mesh(mugGeometry, ceramic))
  mug.position.set(MUG.x, DESK_Y + MUG.h / 2, MUG.z)
  disposables.push(mugGeometry)

  const handleGeometry = new THREE.TorusGeometry(0.17, 0.046, 14, 28)
  const handle = prop(new THREE.Mesh(handleGeometry, ceramic), { cast: false })
  handle.position.set(MUG.x + MUG.r - 0.02, DESK_Y + MUG.h * 0.55, MUG.z)
  handle.rotation.y = Math.PI / 2
  disposables.push(handleGeometry)

  // The coffee, sunk a little below the rim the way a real cup sits.
  const brewGeometry = new THREE.CircleGeometry(MUG.r * 0.9, 40)
  const brewMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2a1a12),
    roughness: 0.2,
    metalness: 0.06,
  })
  const brew = new THREE.Mesh(brewGeometry, brewMaterial)
  brew.rotation.x = -Math.PI / 2
  brew.position.set(MUG.x, DESK_Y + MUG.h - 0.06, MUG.z)
  group.add(brew)
  disposables.push(brewGeometry, brewMaterial)

  // Pen cup: 9cm across, 10cm tall, and actually holding something.
  const CUP = { x: 2.05, z: -0.78, r: 0.38, h: 0.85 }
  const cupGeometry = new THREE.CylinderGeometry(CUP.r, CUP.r * 0.9, CUP.h, 36)
  const cup = prop(new THREE.Mesh(cupGeometry, darkTrim))
  cup.position.set(CUP.x, DESK_Y + CUP.h / 2, CUP.z)
  disposables.push(cupGeometry)

  const standIn = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    angle: number,
    radius: number,
    length: number,
  ) => {
    const item = prop(new THREE.Mesh(geometry, material), { cast: false })
    const lean = 0.14
    item.position.set(
      CUP.x + Math.sin(angle) * radius,
      DESK_Y + CUP.h * 0.55 + length * 0.32,
      CUP.z + Math.cos(angle) * radius,
    )
    item.rotation.set(Math.cos(angle) * lean, angle, -Math.sin(angle) * lean)
    return item
  }

  // Two pens, round. 14cm.
  const penGeometry = new THREE.CylinderGeometry(0.034, 0.034, 1.2, 12)
  disposables.push(penGeometry)
  ;[palette.accent, palette.secondary].forEach((colour, i) => {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colour),
      roughness: 0.42,
      metalness: 0.18,
    })
    standIn(penGeometry, material, -0.9 + i * 0.7, 0.17, 1.2)
    disposables.push(material)
  })

  // A pencil, hexagonal - six radial segments is all that takes, and it
  // is what separates it from the pens at a glance.
  const pencilGeometry = new THREE.CylinderGeometry(0.032, 0.032, 1.1, 6)
  const pencilMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0xd8b25a : 0xc79a3c),
    roughness: 0.62,
  })
  standIn(pencilGeometry, pencilMaterial, 0.55, 0.18, 1.1)
  disposables.push(pencilGeometry, pencilMaterial)

  // A 30cm ruler.
  const rulerGeometry = new THREE.BoxGeometry(0.26, 2.54, 0.018)
  const rulerMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x9fb0ad : 0xdfe7e3),
    roughness: 0.3,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88,
  })
  const ruler = standIn(rulerGeometry, rulerMaterial, 1.9, 0.2, 2.54)
  ruler.position.y = DESK_Y + CUP.h * 0.5 + 0.86
  disposables.push(rulerGeometry, rulerMaterial)

  // A potted cactus, left of the machine.
  //
  // Left rather than right because the right band is already taken by the
  // mug and the pen cup, and the spots further right either collide with
  // them or fall outside the frame at that depth. It sits partly under
  // the type scrim, which suits it - a plant is background, and it
  // balances a composition whose props were otherwise all on one side.
  //
  // The pot and plant themselves are built in plant.ts.
  const plant = makePlant(palette, shadows)
  plant.group.position.set(-2.0, DESK_Y + 0.052, -0.2)
  plant.group.rotation.y = 0.4
  group.add(plant.group)
  disposables.push(plant)

  // Closed A5 notebook, front left of the machine, clear of both the
  // laptop footprint and the ledger pile.
  const bookSlab = slab(1.27, 1.78, 0.09, 0.03)
  const bookMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x1d2530 : 0xd3ddd8),
    roughness: 0.8,
    metalness: 0,
  })
  const book = prop(new THREE.Mesh(bookSlab.geometry, bookMaterial), { receive: true })
  book.rotation.set(-Math.PI / 2, 0, 0.22)
  book.position.set(-1.05, DESK_Y + bookSlab.halfDepth, 1.9)
  disposables.push(bookSlab.geometry, bookMaterial)

  const bandGeometry = new THREE.PlaneGeometry(0.07, 1.78)
  const bandMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.accent),
    roughness: 0.5,
  })
  const band = new THREE.Mesh(bandGeometry, bandMaterial)
  band.rotation.set(-Math.PI / 2, 0, 0.22)
  band.position.set(
    -1.05 + Math.cos(0.22) * 0.46,
    DESK_Y + bookSlab.halfDepth * 2 + 0.002,
    1.9 + Math.sin(0.22) * 0.46,
  )
  group.add(band)
  disposables.push(bandGeometry, bandMaterial)

  // Where the paper is born. The screen sits inside the tilted lid, so
  // its world position has to be resolved rather than assumed.
  lid.updateWorldMatrix(true, true)
  const screenAnchor = new THREE.Vector3()
  screen.getWorldPosition(screenAnchor)

  return {
    group,
    screenAnchor,
    cursor,
    cursorMaterial,
    setPressed(pressed: boolean) {
      const next = pressed ? pressedTexture : screenTexture
      screenMaterial.map = next
      screenMaterial.emissiveMap = next
      screenMaterial.needsUpdate = true
    },
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}

/** Screen-local coordinates for the button the cursor presses. */
export const BUTTON_LOCAL = new THREE.Vector2(
  // Button centre in the 1360x850 screen texture: (428, 591).
  (428 / 1360 - 0.5) * SCREEN_W,
  (0.5 - 591 / 850) * SCREEN_H,
)
