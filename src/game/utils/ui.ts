export function hpBarColor(pct: number): string {
  if (pct > 50) return '#44dd44'
  if (pct > 25) return '#ffcc00'
  return '#ff3333'
}
