/**
 * The motion vocabulary, in one place.
 *
 * DESIGN-SYSTEM.md §5 calls for exactly three spring presets in place of
 * the twenty-odd ad-hoc configs scattered through the landing
 * components. This is that file. Import from here rather than writing a
 * new `{ type: "spring", stiffness: ... }` inline.
 */

export const SPRING = {
  /** Page and section entrances, large elements. */
  soft: { type: "spring", stiffness: 100, damping: 20 },
  /** Cards, list items, layout shifts. */
  medium: { type: "spring", stiffness: 220, damping: 22 },
  /** Cursor-tracked, hover, magnetic. Must feel immediate. */
  snappy: { type: "spring", stiffness: 350, damping: 30 },
} as const

/**
 * The house curve: fast pickup, long graceful settle. Default for
 * anything that enters and is not a physical object.
 */
export const EASE_HOUSE = [0.16, 1, 0.3, 1] as const
