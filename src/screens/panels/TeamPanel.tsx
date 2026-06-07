import { useState, useRef } from 'react'
import styles from './TeamPanel.module.css'
import type { PokemonInstance } from '../../game/entities/PokemonInstance'
import { PokemonSprite } from '../../components/PokemonSprite'
import { TypeBadge } from '../../components/TypeBadge'
import { PokemonInfoModal } from '../../components/PokemonInfoModal'
import { ItemIcon } from '../../components/ItemIcon'

interface Props {
  team:              PokemonInstance[]
  placedIndices:     Set<number>
  faintedIndices:    Set<number>
  locked:            boolean
  onBack:            () => void
  onReorder?:        (from: number, to: number) => void
  onItemDrop?:       (dragJson: string, toTeamIdx: number) => void
  onConsumableDrop?: (dragJson: string, toTeamIdx: number) => void
}

export function TeamPanel({ team, placedIndices, faintedIndices, locked, onBack, onReorder, onItemDrop, onConsumableDrop }: Props) {
  const [inspected,        setInspected]        = useState<PokemonInstance | null>(null)
  const [dragOverIdx,      setDragOverIdx]      = useState<number | null>(null)
  const [dragOverItemSlot, setDragOverItemSlot] = useState<number | null>(null)
  const [consumeOverIdx,   setConsumeOverIdx]   = useState<number | null>(null)
  const dragSourceIdx = useRef<number | null>(null)

  return (
    <div className={`${styles.panel} ${locked ? styles.locked : ''}`}>
      <button className={styles.backBtn} onClick={onBack}>← Menú</button>

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
              <PokemonSprite id={pokemon.data.id} flip className={styles.sprite} />
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
                  background: hpPct > 50 ? '#44dd44' : hpPct > 25 ? '#ffcc00' : '#ff3333',
                }}
              />
            </div>
          </div>
        )
      })}

      {inspected && (
        <PokemonInfoModal pokemon={inspected} onClose={() => setInspected(null)} />
      )}
    </div>
  )
}
