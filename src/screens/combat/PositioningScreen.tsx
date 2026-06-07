import { useState } from 'react'
import styles from './PositioningScreen.module.css'
import type { PokemonInstance } from '../../game/entities/PokemonInstance'

interface Props {
  playerTeam: PokemonInstance[]
  enemyTeam:  PokemonInstance[]
  placements: (number | null)[]
  onPlace:    (slotIndex: number, teamIndex: number) => void
  onUnplace:  (slotIndex: number) => void
  onStart:    () => void
}

export function PositioningScreen({ playerTeam, enemyTeam, placements, onPlace, onUnplace, onStart }: Props) {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  const handleDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlot(slotIndex)
  }

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    setDragOverSlot(null)
    const teamIndex = parseInt(e.dataTransfer.getData('teamIndex'), 10)
    if (!isNaN(teamIndex)) onPlace(slotIndex, teamIndex)
  }

  const canStart = placements.some(p => p !== null)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Posiciona tu equipo</span>
        <button className={styles.startBtn} disabled={!canStart} onClick={onStart}>
          START
        </button>
      </div>

      <div className={styles.zones}>
        {Array.from({ length: 6 }, (_, slotIndex) => {
          const teamIdx   = placements[slotIndex]
          const player    = teamIdx !== null ? playerTeam[teamIdx] : null
          const enemy     = enemyTeam[slotIndex] ?? null
          const isOver    = dragOverSlot === slotIndex

          return (
            <div key={slotIndex} className={styles.zone}>

              {/* Player side — drop target */}
              <div
                className={`${styles.playerSide} ${isOver ? styles.dragOver : ''} ${player ? styles.filled : styles.empty}`}
                onDragOver={e => handleDragOver(e, slotIndex)}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={e => handleDrop(e, slotIndex)}
              >
                {player ? (
                  <div className={styles.pokemonCard}>
                    {player.data.sprites.front && (
                      <img src={player.data.sprites.front} alt={player.data.name} className={styles.cardSprite} />
                    )}
                    <div className={styles.cardInfo}>
                      <div className={styles.cardName}>{player.data.name}</div>
                      <div className={styles.cardLevel}>Nv. {player.level}</div>
                    </div>
                    <button className={styles.removeBtn} onClick={() => onUnplace(slotIndex)}>✕</button>
                  </div>
                ) : (
                  <span className={styles.emptyLabel}>Hueco libre</span>
                )}
              </div>

              {/* Enemy side */}
              <div className={styles.enemySide}>
                {enemy ? (
                  <div className={styles.enemyCard}>
                    {enemy.data.sprites.front && (
                      <img src={enemy.data.sprites.front} alt={enemy.data.name} className={styles.enemySprite} />
                    )}
                    <div>
                      <div className={styles.enemyName}>{enemy.data.name}</div>
                      <div className={styles.cardLevel}>Nv. {enemy.level}</div>
                    </div>
                  </div>
                ) : (
                  <span className={styles.emptyLabel}>—</span>
                )}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}
