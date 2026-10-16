import * as THREE from "three"

import type { Palette } from "./paper"

/**
 * The potted cactus.
 *
 * Its own module because doing it properly is not a matter of stacking
 * two cylinders. The first attempt was exactly that - a tapered tube with
 * a capsule stuck in it - and it read as a placeholder.
 *
 * Three things carry the difference, and all three are structural rather
 * than decorative:
 *
 *   1. Both pot and plant are surfaces of revolution built from a drawn
 *      profile, so the pot has a foot, a shoulder and a rim with real
 *      thickness you can see into. A truncated cone has none of those.
 *   2. The revolution is then modulated radially, which gives the pot its
 *      fluting and the cactus its ribs. Ribs are the whole silhouette of
 *      a columnar cactus; without them it is a green sausage.
 *   3. Spines sit on the rib crests, instanced - two hundred of them for
 *      one draw call.
 */

/** Radius of the outer wall at a given height, by linear interpolation. */
function radiusAt(profile: THREE.Vector2[], y: number): number {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]
    const b = profile[i + 1]
    if (y >= a.y && y <= b.y && b.y !== a.y) {
      return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)
    }
  }
  return profile[profile.length - 1].x
}

/**
 * Revolves a profile, then pushes each ring in and out around its axis.
 *
 * `ribs` sets how many crests; `amp` how deep. Normals are recomputed
 * afterwards or the flutes would be lit as if the surface were still
 * smooth, which is the tell that separates real fluting from a texture.
 */
function ribbedLathe(
  profile: THREE.Vector2[],
  ribs: number,
  amp: number,
  segments: number,
): THREE.BufferGeometry {
  const geometry = new THREE.LatheGeometry(profile, segments)
  const position = geometry.attributes.position

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-5) continue

    const theta = Math.atan2(z, x)
    const k = 1 + amp * Math.cos(ribs * theta)
    position.setX(i, Math.cos(theta) * r * k)
    position.setZ(i, Math.sin(theta) * r * k)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

const V = (x: number, y: number) => new THREE.Vector2(x, y)

/**
 * Pot profile, bottom to top and then back down the inside.
 *
 * The inner wall is what makes it a vessel rather than a solid: the rim
 * has thickness, and you can see down into the gravel.
 */
const POT_PROFILE = [
  V(0.0, 0.0),
  V(0.24, 0.0),
  V(0.265, 0.025),
  V(0.275, 0.07),
  V(0.315, 0.26),
  V(0.36, 0.5),
  V(0.392, 0.68),
  V(0.404, 0.76),
  V(0.408, 0.795), // rim, outer
  V(0.392, 0.81), // rim, top
  V(0.376, 0.79), // rim, inner
  V(0.352, 0.5),
  V(0.3, 0.16),
  V(0.0, 0.145), // inner floor
]

const SAUCER_PROFILE = [
  V(0.0, 0.0),
  V(0.46, 0.0),
  V(0.5, 0.02),
  V(0.505, 0.07),
  V(0.49, 0.078),
  V(0.47, 0.03),
  V(0.0, 0.022),
]

/** Columnar cactus: straight sided, domed at the top. */
const BODY_PROFILE = [
  V(0.0, 0.0),
  V(0.145, 0.015),
  V(0.172, 0.09),
  V(0.182, 0.3),
  V(0.184, 0.62),
  V(0.178, 0.86),
  V(0.158, 1.0),
  V(0.108, 1.09),
  V(0.0, 1.125),
]

const ARM_PROFILE = [
  V(0.0, 0.0),
  V(0.085, 0.02),
  V(0.1, 0.08),
  V(0.104, 0.26),
  V(0.098, 0.42),
  V(0.076, 0.52),
  V(0.0, 0.56),
]

const BODY_RIBS = 8
const BODY_AMP = 0.1
const ARM_RIBS = 7
const ARM_AMP = 0.11

export interface Plant {
  group: THREE.Group
  dispose(): void
}

export function makePlant(palette: Palette, shadows: boolean): Plant {
  const group = new THREE.Group()
  const disposables: { dispose(): void }[] = []

  // ── Pot ───────────────────────────────────────────────────────────
  // Matte stoneware. High roughness and no metalness - a glossy pot next
  // to a machined aluminium shell reads as plastic.
  const stoneware = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x525a63 : 0xf4f2ee),
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  disposables.push(stoneware)

  // Twenty shallow flutes. Deep enough to catch the key light down one
  // side, shallow enough that the pot still reads as a clean cylinder.
  const potGeometry = ribbedLathe(POT_PROFILE, 20, 0.016, 72)
  const pot = new THREE.Mesh(potGeometry, stoneware)
  pot.castShadow = shadows
  group.add(pot)
  disposables.push(potGeometry)

  const saucerGeometry = ribbedLathe(SAUCER_PROFILE, 20, 0.01, 72)
  const saucer = new THREE.Mesh(saucerGeometry, stoneware)
  saucer.position.y = -0.052
  saucer.castShadow = shadows
  saucer.receiveShadow = shadows
  group.add(saucer)
  disposables.push(saucerGeometry)

  // ── Gravel top dressing ───────────────────────────────────────────
  // Instanced: forty pebbles for one draw call. A flat disc of "soil"
  // was the cheapest part of the old plant and looked it.
  const pebbleGeometry = new THREE.IcosahedronGeometry(0.028, 0)
  const pebbleMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x1a1d22 : 0x3a3f45),
    roughness: 0.95,
    flatShading: true,
  })
  const pebbles = new THREE.InstancedMesh(pebbleGeometry, pebbleMaterial, 44)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  for (let i = 0; i < 44; i++) {
    // Golden-angle spiral keeps them evenly spread without clumping.
    const t = i / 44
    const radius = 0.05 + Math.sqrt(t) * 0.25
    const angle = i * 2.39996
    q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3))
    scale.setScalar(0.65 + Math.random() * 0.6)
    m.compose(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        0.155 + Math.random() * 0.012,
        Math.sin(angle) * radius,
      ),
      q,
      scale,
    )
    pebbles.setMatrixAt(i, m)
  }
  pebbles.instanceMatrix.needsUpdate = true
  group.add(pebbles)
  disposables.push(pebbleGeometry, pebbleMaterial)

  // ── Cactus ────────────────────────────────────────────────────────
  const flesh = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0x3d7d58 : 0x4f9464),
    roughness: 0.84,
    metalness: 0,
  })
  disposables.push(flesh)

  const bodyGeometry = ribbedLathe(BODY_PROFILE, BODY_RIBS, BODY_AMP, 64)
  const body = new THREE.Mesh(bodyGeometry, flesh)
  body.position.y = 0.14
  body.castShadow = shadows
  group.add(body)
  disposables.push(bodyGeometry)

  // Arms, angled up and out the way the reference does - branching low
  // on the column, not sprouting from the middle.
  const armGeometry = ribbedLathe(ARM_PROFILE, ARM_RIBS, ARM_AMP, 48)
  disposables.push(armGeometry)

  const arms: { angle: number; height: number; lean: number; scale: number }[] = [
    { angle: -0.5, height: 0.42, lean: 0.62, scale: 1.0 },
    { angle: 2.5, height: 0.5, lean: 0.58, scale: 0.86 },
    { angle: 1.3, height: 0.34, lean: 0.72, scale: 0.74 },
  ]

  const armNodes: THREE.Object3D[] = []
  for (const spec of arms) {
    const arm = new THREE.Mesh(armGeometry, flesh)
    const r = radiusAt(BODY_PROFILE, spec.height) * 0.85
    arm.position.set(
      Math.cos(spec.angle) * r,
      0.14 + spec.height,
      Math.sin(spec.angle) * r,
    )
    arm.scale.setScalar(spec.scale)
    // Tip away from the column, around the column's own axis.
    arm.rotation.set(0, -spec.angle, spec.lean)
    arm.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0)
    arm.castShadow = shadows
    group.add(arm)
    armNodes.push(arm)
  }

  // ── Spines ────────────────────────────────────────────────────────
  // Placed on the rib crests, pointing out along the surface normal and
  // tilted up. All of them are one InstancedMesh.
  const spineGeometry = new THREE.ConeGeometry(0.011, 0.055, 4, 1)
  const spineMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.isDark ? 0xe7dfae : 0xcfc290),
    roughness: 0.7,
    flatShading: true,
  })

  type Spine = { pos: THREE.Vector3; dir: THREE.Vector3; scale: number }
  const spines: Spine[] = []

  const addSpines = (
    profile: THREE.Vector2[],
    ribs: number,
    amp: number,
    node: THREE.Object3D | null,
    yFrom: number,
    yTo: number,
    step: number,
    localYOffset: number,
    sizeScale: number,
  ) => {
    for (let rib = 0; rib < ribs; rib++) {
      const theta = (rib / ribs) * Math.PI * 2
      for (let y = yFrom; y <= yTo; y += step) {
        const r = radiusAt(profile, y) * (1 + amp)
        const local = new THREE.Vector3(
          Math.cos(theta) * r,
          y + localYOffset,
          Math.sin(theta) * r,
        )
        // Outward, tilted up - a spine points away from the flesh and
        // toward the light, never straight sideways.
        const dir = new THREE.Vector3(Math.cos(theta), 0.55, Math.sin(theta)).normalize()

        if (node) {
          local.applyEuler(node.rotation).multiplyScalar(node.scale.x).add(node.position)
          dir.applyEuler(node.rotation)
        }
        spines.push({ pos: local, dir, scale: sizeScale })
      }
    }
  }

  addSpines(BODY_PROFILE, BODY_RIBS, BODY_AMP, null, 0.1, 1.02, 0.075, 0.14, 1)
  armNodes.forEach((node, i) => {
    addSpines(ARM_PROFILE, ARM_RIBS, ARM_AMP, node, 0.08, 0.48, 0.075, 0, arms[i].scale)
  })

  const spineMesh = new THREE.InstancedMesh(spineGeometry, spineMaterial, spines.length)
  const up = new THREE.Vector3(0, 1, 0)
  spines.forEach((spine, i) => {
    q.setFromUnitVectors(up, spine.dir)
    m.compose(spine.pos, q, scale.setScalar(spine.scale))
    spineMesh.setMatrixAt(i, m)
  })
  spineMesh.instanceMatrix.needsUpdate = true
  group.add(spineMesh)
  disposables.push(spineGeometry, spineMaterial)

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
