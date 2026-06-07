import styles from './SynergyPanel.module.css'
import type { PokemonInstance } from '../../game/entities/PokemonInstance'
import { SYNERGIES, type Synergy } from '../../game/combat/SynergyManager'
import { TypeBadge } from '../../components/TypeBadge'

interface Props {
  playerTeam: PokemonInstance[]
  enemyTeam:  PokemonInstance[]
}

const THRESHOLDS = [2, 4, 6] as const

function getRows(team: PokemonInstance[]) {
  return SYNERGIES
    .map(s => ({ synergy: s, count: s.getCount(team), level: s.getLevel(team) }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.level - a.level || b.count - a.count)
}

function nextThreshold(count: number): number | null {
  return THRESHOLDS.find(t => t > count) ?? null
}

interface RowProps { synergy: Synergy; count: number; level: 0 | 1 | 2 | 3 }

function SynergyRow({ synergy, count, level }: RowProps) {
  const active = level > 0
  const next   = nextThreshold(count)
  const stars  = active ? '★'.repeat(level) + '☆'.repeat(3 - level) : null

  return (
    <div className={`${styles.row} ${active ? styles.rowActive : ''}`}>
      <div className={styles.rowHeader}>
        <span className={`${styles.dot} ${active ? styles.dotActive : ''}`} />
        <TypeBadge type={synergy.type} />
        <span className={styles.synergyName}>{synergy.name}</span>
        {stars && <span className={styles.stars}>{stars}</span>}
        <span className={styles.counter}>
          {next ? `${count}/${next}` : `${count}/6`}
        </span>
      </div>
      {active && (
        <p className={styles.desc}>{synergy.effects[level - 1].description}</p>
      )}
    </div>
  )
}

function Section({ title, team }: { title: string; team: PokemonInstance[] }) {
  const rows = getRows(team)
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {rows.length === 0
        ? <div className={styles.empty}>Sin sinergias</div>
        : rows.map(r => <SynergyRow key={r.synergy.id} {...r} />)
      }
    </div>
  )
}

export function SynergyPanel({ playerTeam, enemyTeam }: Props) {
  return (
    <div className={styles.panel}>
      <Section title="Sinergias — Jugador" team={playerTeam} />
      <div className={styles.divider} />
      <Section title="Sinergias — Rival"  team={enemyTeam} />
    </div>
  )
}
