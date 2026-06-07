import { TYPE_COLOR, TYPE_ABBREV } from '../game/utils/typeData'
import type { PokemonType } from '../types'

export function TypeBadge({ type }: { type: PokemonType }) {
  const color  = TYPE_COLOR[type]
  const abbrev = TYPE_ABBREV[type]
  return (
    <svg width={34} height={13} viewBox="0 0 34 13" style={{ display: 'block' }}>
      <rect rx="3" width={34} height={13} fill={color} />
      <text
        x={17} y="9.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="800"
        fontFamily="Arial, sans-serif"
        fill="rgba(255,255,255,0.95)"
        letterSpacing="0.3"
      >{abbrev}</text>
    </svg>
  )
}

export function TypeBadges({ types }: { types: PokemonType[] }) {
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {types.map(t => <TypeBadge key={t} type={t} />)}
    </div>
  )
}
