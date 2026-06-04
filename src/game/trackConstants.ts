const SCREEN_CENTER_X = 550
const SCREEN_CENTER_Y = 375

const OUTER_TRACK_RADIUS_X = 485
const OUTER_TRACK_RADIUS_Y = 310

const INNER_TRACK_RADIUS_X = 270
const INNER_TRACK_RADIUS_Y = 165

export const OUTER = {
  cx: SCREEN_CENTER_X,
  cy: SCREEN_CENTER_Y,
  a: OUTER_TRACK_RADIUS_X,
  b: OUTER_TRACK_RADIUS_Y,
}

export const INNER = {
  cx: SCREEN_CENTER_X,
  cy: SCREEN_CENTER_Y,
  a: INNER_TRACK_RADIUS_X,
  b: INNER_TRACK_RADIUS_Y,
}

/**
 * Returns a value < 1 if the point is inside the ellipse, = 1 on the boundary, > 1 outside.
 */
export function ellipseValue(x: number, y: number, e: typeof OUTER): number {
  return ((x - e.cx) / e.a) ** 2 + ((y - e.cy) / e.b) ** 2
}

/**
 * Returns true if the point is within the drivable track surface (between inner and outer ellipses).
 */
export function isOnTrack(x: number, y: number): boolean {
  return ellipseValue(x, y, OUTER) <= 1 && ellipseValue(x, y, INNER) >= 1
}
