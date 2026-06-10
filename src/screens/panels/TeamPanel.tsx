import { useState, useRef } from 'react'
import styles from './TeamPanel.module.css'
import type { PokemonInstance } from '../../game/entities/PokemonInstance'
import { PokemonSprite } from '../../components/PokemonSprite'
import { TypeBadge } from '../../components/TypeBadge'
import { PokemonInfoModal } from '../../components/PokemonInfoModal'
import { ItemIcon } from '../../components/ItemIcon'
import { PokedexButton } from '../../components/PokedexModal'
import { hpBarColor } from '../../game/utils/ui'

interface Props {
  team:              PokemonInstance[]
  placedIndices:     Set<number>
  faintedIndices:    Set<number>
  locked:            boolean
  side?:             'player' | 'enemy'
  money?:            number
  onBack?:           () => void
  onReorder?:        (from: number, to: number) => void
  onItemDrop?:       (dragJson: string, toTeamIdx: number) => void
  onConsumableDrop?: (dragJson: string, toTeamIdx: number) => void
  onPokemonDrop?:    (dragJson: string) => void
}

export function TeamPanel({ team, placedIndices, faintedIndices, locked, side = 'player', money, onBack, onReorder, onItemDrop, onConsumableDrop, onPokemonDrop }: Props) {
  const [inspected,        setInspected]        = useState<PokemonInstance | null>(null)
  const [dragOverIdx,      setDragOverIdx]      = useState<number | null>(null)
  const [dragOverItemSlot, setDragOverItemSlot] = useState<number | null>(null)
  const [consumeOverIdx,   setConsumeOverIdx]   = useState<number | null>(null)
  const [pokemonDragOver,  setPokemonDragOver]  = useState(false)
  const dragSourceIdx = useRef<number | null>(null)

  return (
    <div
      className={`${styles.panel} ${locked ? styles.locked : ''} ${pokemonDragOver ? styles.pokemonOver : ''}`}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('pokemondrag')) {
          e.preventDefault()
          setPokemonDragOver(true)
        }
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPokemonDragOver(false)
      }}
      onDrop={e => {
        if (!e.dataTransfer.types.includes('pokemondrag')) return
        e.preventDefault()
        setPokemonDragOver(false)
        const json = e.dataTransfer.getData('pokemondrag')
        if (json) onPokemonDrop?.(json)
      }}
    >
      {onBack && <button className={styles.backBtn} onClick={onBack}>← Menú</button>}

      {team.map((pokemon, i) => {
        const placed   = placedIndices.has(i)
        const fainted  = faintedIndices.has(i)
        const hpPct    = (pokemon.currentHp / pokemon.getMaxHp()) * 100
        const canDrag  = !placed && !locked && !fainted
        const isConsOver = consumeOverIdx === i

        return (
          <div
            key={i}
            className={`
              ${styles.card}
              ${placed    ? styles.placed  : ''}
              ${fainted   ? styles.fainted : ''}
              ${dragOverIdx === i ? styles.dropOver : ''}
              ${isConsOver ? styles.consumeOver : ''}
            `}
            draggable={canDrag}
            onDragStart={e => {
              dragSourceIdx.current = i
              e.dataTransfer.setData('teamIndex', String(i))
              e.dataTransfer.setData('teamside', side)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              dragSourceIdx.current = null
              setDragOverIdx(null)
            }}
            onDragOver={e => {
              if (e.dataTransfer.types.includes('consumabledrag')) {
                e.stopPropagation()
                e.preventDefault()
                setConsumeOverIdx(i)
                return
              }
              if (dragSourceIdx.current === null || dragSourceIdx.current === i) return
              e.preventDefault()
              setDragOverIdx(i)
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverIdx(null)
                setConsumeOverIdx(null)
              }
            }}
            onDrop={e => {
              // Consumable drop on card
              if (e.dataTransfer.types.includes('consumabledrag')) {
                e.stopPropagation()
                e.preventDefault()
                setConsumeOverIdx(null)
                const json = e.dataTransfer.getData('consumabledrag')
                if (json) onConsumableDrop?.(json, i)
                return
              }
              // Item equip drops — handled by item slot below
              if (e.dataTransfer.types.includes('itemdrag')) return
              // Pokémon reorder
              e.preventDefault()
              setDragOverIdx(null)
              const src = dragSourceIdx.current
              if (src !== null && src !== i) onReorder?.(src, i)
              dragSourceIdx.current = null
            }}
          >
            <div className={styles.typeBadges}>
              {pokemon.data.types.map(t => <TypeBadge key={t} type={t} />)}

              {/* ── Item slot (equipables only) ── */}
              <div
                className={`${styles.itemSlot} ${dragOverItemSlot === i ? styles.itemSlotOver : ''}`}
                draggable={!!pokemon.equippedItem}
                onDragStart={pokemon.equippedItem ? e => {
                  e.stopPropagation()
                  e.dataTransfer.setData('itemdrag', JSON.stringify({ source: 'pokemon', teamIdx: i }))
                  e.dataTransfer.effectAllowed = 'move'
                  const img = e.currentTarget.querySelector('img')
                  if (img) e.dataTransfer.setDragImage(img, 9, 9)
                } : undefined}
                onDragOver={e => {
                  e.stopPropagation()
                  if (!e.dataTransfer.types.includes('itemdrag')) return
                  e.preventDefault()
                  setDragOverItemSlot(i)
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverItemSlot(null)
                }}
                onDrop={e => {
                  e.stopPropagation()
                  e.preventDefault()
                  setDragOverItemSlot(null)
                  const json = e.dataTransfer.getData('itemdrag')
                  if (json) onItemDrop?.(json, i)
                }}
              >
                {pokemon.equippedItem
                  ? <ItemIcon item={pokemon.equippedItem} size={18} />
                  : <span className={styles.itemEmpty}>○</span>
                }
              </div>
            </div>

            <button
              className={styles.infoBtn}
              onClick={e => { e.stopPropagation(); setInspected(pokemon) }}
            >!</button>

            <div className={styles.spriteWrap}>
              <PokemonSprite id={pokemon.data.id} shiny={pokemon.shiny} flip className={styles.sprite} />
            </div>

            <div className={styles.nameRow}>
              <span className={styles.name}>{pokemon.data.name}</span>
              <span className={styles.level}>Nv.{pokemon.level}</span>
            </div>

            <div className={styles.hpBarBg}>
              <div
                className={styles.hpBarFill}
                style={{
                  width: `${hpPct}%`,
                  background: hpBarColor(hpPct),
                }}
              />
            </div>
          </div>
        )
      })}

      {inspected && (
        <PokemonInfoModal pokemon={inspected} onClose={() => setInspected(null)} />
      )}

      {money !== undefined && (
        <div className={styles.bottomSection}>
          <PokedexButton className={styles.pokedexBtn} />
          <div className={styles.wallet}>
            <svg viewBox="0 0 44 34" width="44" height="34" aria-hidden="true">
              <rect x="2" y="10" width="40" height="22" rx="8" fill="#bb1111"/>
              <ellipse cx="22" cy="13" rx="17" ry="11" fill="#cc2222"/>
              <ellipse cx="22" cy="17" rx="14" ry="7" fill="#bb1111"/>
              <rect x="15" y="4" width="14" height="8" rx="4" fill="#ffd700"/>
              <rect x="18" y="6" width="8" height="4" rx="2" fill="#cc9900"/>
              <g transform="translate(13.5, 15)" fill="none" stroke="#ff9999" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="0" x2="3" y2="11"/>
                <path d="M3 0 Q9.5 0 9.5 3.5 Q9.5 7 3 7"/>
                <line x1="0.5" y1="8.5"  x2="10" y2="8.5"/>
                <line x1="0.5" y1="10.5" x2="10" y2="10.5"/>
              </g>
            </svg>
            <span className={styles.walletAmount}>{money.toLocaleString('es-ES')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
