import * as THREE from "three"

import type { Palette } from "./paper"

/**
 * Geometry, materials and lighting for the hero stage.
 *
 * Split out of the choreography because it is the part that decides
 * whether the scene reads as paper or as textured rectangles, and it is
 * worth reading on its own.
 */

export const CARD_W = 1.92
export const CARD_H = 1.2
const CARD_THICKNESS = 0.022
const CARD_RADIUS = 0.052

/**
 * A card is a real extruded solid, not a plane.
 *
 * Three things follow from that and none of them are available from a
 * PlaneGeometry: the corners are genuinely round rather than cut out of
 * the texture's alpha, the sheet has an edge that catches the key light
 * as it turns, and it can cast a shadow that has thickness. The bevel is
 * tiny - paper is thin - but it is what stops the card reading as a
 * decal floating in space.
 */
export function makeCardGeometry(): THREE.ExtrudeGeometry {
  const w = CARD_W
  const h = CARD_H
  const r = CARD_RADIUS

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
    depth: CARD_THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 10,
  })
  geometry.center()

  // ExtrudeGeometry's default UVs are world-space, so the texture would
  // land at an arbitrary offset and scale. Remap after centring so the
  // face maps the card art exactly 0..1. The side walls pick up the
  // texture's outer pixels, which is what a printed sheet's edge looks
  // like anyway.
  const position = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + w / 2) / w, (position.getY(i) + h / 2) / h)
  }
  uv.needsUpdate = true
  geometry.computeVertexNormals()

  return geometry
}

export function makeCardMaterial(map: THREE.Texture | null): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map,
    // Paper: no specular highlight to speak of, no metal.
    roughness: 0.82,
    metalness: 0,
    transparent: true,
    opacity: 0,
  })
}

export interface Rig {
  group: THREE.Group
  floor: THREE.Mesh
  dispose(): void
}

/**
 * Key / fill / rim, plus a hemisphere for ambient bounce.
 *
 * These intensities are computed, not guessed. The first version summed
 * to roughly 1.8 irradiance on a card facing the camera, against a
 * MeshStandardMaterial that clips at 1.0 - so every sheet blew out to
 * pure white and the printing on it disappeared. That is what a "white
 * paper bug" actually was.
 *
 * The constraint is that two very different orientations both have to
 * land in range: a card standing upright facing the lens, and the ledger
 * pile lying back at -1.14 rad with its face turned toward the sky.
 *
 *   upright normal (0, 0, 1)   -> hemi 0.50·H + key 0.72·K + fill 0.53·F
 *   flat pile normal (0, 1, 0) -> hemi 1.00·H + key 0.51·K + fill 0.19·F
 *
 * The pile's figures changed once it was laid flat: square to the sky but
 * grazed by the key, it fell from about 1.09 to 0.89 - leaving headroom
 * the cards were not using, while their labels were the hardest thing on
 * screen to read.
 *
 * H 0.60, K 0.71, F 0.30 lands an upright card at 0.97 and the pile at
 * 1.02. Two per cent over on a surface facing straight up is nothing, and
 * the extra 15% on the paper is what the type needed.
 *
 * The key was also moved lower and more frontal than the original
 * (2.6, 4.2, 3.4). Overhead light hammered the pile specifically.
 */
export function makeLightRig(palette: Palette): Rig {
  const group = new THREE.Group()
  const disposables: THREE.Object3D[] = []

  const sky = new THREE.Color(palette.isDark ? 0x38414f : 0xffffff)
  const ground = new THREE.Color(palette.isDark ? 0x0a0d12 : 0xb9c6c2)
  const hemisphere = new THREE.HemisphereLight(sky, ground, 0.6)
  group.add(hemisphere)

  const key = new THREE.DirectionalLight(0xffffff, 0.71)
  key.position.set(2.2, 2.4, 3.4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.radius = 4
  key.shadow.bias = -0.0012
  key.shadow.normalBias = 0.024
  const cam = key.shadow.camera
  cam.near = 0.5
  cam.far = 18
  cam.left = -5
  cam.right = 5
  cam.top = 5
  cam.bottom = -5
  cam.updateProjectionMatrix()
  group.add(key)

  const fill = new THREE.DirectionalLight(0xffffff, 0.3)
  fill.position.set(-3.4, 0.8, 2.2)
  group.add(fill)

  // A cool rim from behind separates the cards from the background at
  // their silhouette. It contributes nothing to a front face - which is
  // why it can be generous without touching the exposure budget above.
  const rim = new THREE.DirectionalLight(
    palette.isDark ? 0x7fe3c8 : 0xffffff,
    palette.isDark ? 1.15 : 0.6,
  )
  rim.position.set(-1.2, 1.6, -3.6)
  group.add(rim)

  disposables.push(hemisphere, key, fill, rim)

  // Catches the key light's shadow and nothing else - invisible where
  // nothing is above it, so the page background shows straight through.
  const floorGeometry = new THREE.PlaneGeometry(24, 24)
  const floorMaterial = new THREE.ShadowMaterial({
    opacity: palette.isDark ? 0.42 : 0.19,
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -1.32
  floor.receiveShadow = true
  group.add(floor)

  return {
    group,
    floor,
    dispose() {
      floorGeometry.dispose()
      floorMaterial.dispose()
      for (const light of disposables) {
        ;(light as THREE.Light).dispose?.()
      }
    },
  }
}
