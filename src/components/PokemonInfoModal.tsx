import { useEffect, type ReactNode } from 'react'
import styles from './PokemonInfoModal.module.css'
import type { PokemonInstance } from '../game/entities/PokemonInstance'
import { PokemonSprite } from './PokemonSprite'
import { TypeBadge, TypeBadges } from './TypeBadge'
import movesRaw from '../assets/moves.json'

interface MoveEntry { type: string; category: string; name: string; level: number }
const movesData = movesRaw as MoveEntry[]

const STAT_KEYS = ['attack', 'defense', 'special_attack', 'special_defense', 'speed'] as const
const STAT_LABEL: Record<typeof STAT_KEYS[number], string> = {
  attack: 'ATK', defense: 'DEF',
  special_attack: 'SpA', special_defense: 'SpD',
  speed: 'SPD',
}

const BASE_STAT_MAX = 255

interface Props {
  pokemon: PokemonInstance
  onClose: () => void
  footer?: ReactNode
}

export function PokemonInfoModal({ pokemon, onClose, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const maxHp  = pokemon.getMaxHp()
  const hpPct  = (pokemon.currentHp / maxHp) * 100
  const hpColor = hpPct > 50 ? '#44dd44' : hpPct > 25 ? '#ffcc00' : '#ff3333'

  const effectiveType = pokemon.getEffectiveType()
  const move = movesData.find(m =>
    m.type === effectiveType &&
    m.category === pokemon.data.attack_category &&
    m.level === pokemon.attackLevel
  )

  const usesSpecial = pokemon.data.attack_category === 'special'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {/* ── Header ── */}
        <div className={styles.header}>
          <PokemonSprite id={pokemon.data.id} className={styles.sprite} />
          <div className={styles.headerInfo}>
            <div className={styles.nameRow}>
              <span className={styles.name}>{pokemon.data.name}</span>
              <span className={styles.level}>Nv. {pokemon.level}</span>
            </div>
            <TypeBadges types={pokemon.data.types} />
            {pokemon.data.is_legendary && <span className={styles.badge}>Legendario</span>}
            {pokemon.data.is_mythical  && <span className={styles.badge}>Mítico</span>}
          </div>
        </div>

        <div className={styles.divider} />

        {/* ── Estadísticas ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>ESTADÍSTICAS</div>

          <div className={styles.statRow}>
            <span className={styles.statLabel}>HP</span>
            <div className={styles.barBg}>
              <div className={styles.barFill} style={{ width: `${hpPct}%`, background: hpColor }} />
            </div>
            <span className={styles.statValue}>{pokemon.currentHp} / {maxHp}</span>
          </div>

          {STAT_KEYS.map(key => {
            const baseStat = pokemon.data.stats[key]
            const instStat = pokemon.getStat(key)
            const pct      = Math.min(100, (baseStat / BASE_STAT_MAX) * 100)
            const isActive = (key === 'attack' && !usesSpecial) || (key === 'special_attack' && usesSpecial)
            return (
              <div key={key} className={`${styles.statRow} ${isActive ? styles.activeStatRow : ''}`}>
                <span className={`${styles.statLabel} ${isActive ? styles.activeStatLabel : ''}`}>
                  {STAT_LABEL[key]}
                </span>
                <div className={styles.barBg}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${pct}%`, background: isActive ? '#f5a623' : '#4488ff' }}
                  />
                </div>
                <span className={styles.statValue}>{instStat}</span>
              </div>
            )
          })}
        </div>

        <div className={styles.divider} />

        {/* ── Ataque ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>ATAQUE</div>

          <div className={styles.moveRow}>
            <span className={styles.moveName}>{move?.name ?? '—'}</span>
            <TypeBadge type={effectiveType} />
          </div>

          <div className={styles.moveMeta}>
            <span className={styles.metaChip}>{usesSpecial ? 'Especial' : 'Físico'}</span>
            <span className={styles.metaStars}>
              {'★'.repeat(pokemon.attackLevel)}{'☆'.repeat(3 - pokemon.attackLevel)}
            </span>
          </div>

          {pokemon.equippedItem && (
            <div className={styles.itemRow}>
              <span className={styles.metaChip}>Ítem</span>
              <span className={styles.itemName}>{pokemon.equippedItem.name}</span>
            </div>
          )}
        </div>

        {footer && (
          <>
            <div className={styles.divider} />
            {footer}
          </>
        )}

      </div>
    </div>
  )
}
