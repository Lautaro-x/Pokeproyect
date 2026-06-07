import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import styles from './CombatArea.module.css'
import { PokemonSprite } from '../../components/PokemonSprite'
import { TypeBadges } from '../../components/TypeBadge'
import { PokemonInfoModal } from '../../components/PokemonInfoModal'
import { CombatManager } from '../../game/combat/CombatManager'
import { CombatPokemon, BONUS_KEYS, BONUS_LABELS } from '../../game/entities/CombatPokemon'
import type { PokemonInstance } from '../../game/entities/PokemonInstance'
import type { PokemonData } from '../../types'
import type { GamePhase } from '../GameLayout'
import { ItemIcon } from '../../components/ItemIcon'

function getSpriteStyle(data: PokemonData, isPlayer: boolean): CSSProperties {
  const mod = data.webm_mod
  if (!mod) return {}
  const zoom = mod.zoom ?? 1
  const [px, py] = mod.zoom_position ?? [0, 0]
  if (zoom === 1 && px === 0 && py === 0) return {}

  const parts: string[] = []
  if (isPlayer) {
    parts.push(zoom !== 1 ? `scaleX(-${zoom}) scaleY(${zoom})` : 'scaleX(-1)')
  } else if (zoom !== 1) {
    parts.push(`scale(${zoom})`)
  }
  if (px !== 0 || py !== 0) parts.push(`translate(${px}px, ${py}px)`)
  return parts.length > 0 ? { transform: parts.join(' ') } : {}
}

export interface RoundResult {
  // kept for potential future use; win/lose resolved by GameLayout from full team HP
}

interface Props {
  playerTeam:       PokemonInstance[]
  enemyTeam:        PokemonInstance[]
  placements:       (number | null)[]
  phase:     GamePhase
  gameRound: number
  onPlace:          (slot: number, teamIdx: number) => void
  onUnplace:        (slot: number) => void
  onStart:          () => void
  onRoundEnd:       (result: RoundResult) => void
  onLevelUp?:       (teamIdx: number, newLevel: number) => void
}

const NUM_SLOTS = 6

function VsDivider() {
  return (
    <div className={styles.vsDivider}>
      <svg width="26" height="26" viewBox="0 0 26 26">
        <text x="13" y="13" textAnchor="middle" dominantBaseline="central"
          fontSize="11" fontWeight="900" fontFamily="Arial Black, Impact, sans-serif"
          fill="#e63946" stroke="#ffd700" strokeWidth="1.5" paintOrder="stroke" letterSpacing="-1"
        >VS</text>
      </svg>
    </div>
  )
}

function RoundStartBanner() {
  return (
    <div className={styles.roundStartOverlay}>
      <svg viewBox="0 0 300 56" style={{ width: '90%', maxWidth: 340, overflow: 'visible' }}>
        <text
          x="150" y="44"
          textAnchor="middle"
          fontSize="38"
          fontWeight="900"
          fontFamily="Arial Black, Impact, sans-serif"
          fill="#e63946"
          stroke="#ffd700"
          strokeWidth="3"
          paintOrder="stroke"
          letterSpacing="1"
        >ROUND START!</text>
      </svg>
    </div>
  )
}

function InfoBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.infoBtn} onClick={e => { e.stopPropagation(); onClick() }}>!</button>
  )
}

export function CombatArea({
  playerTeam, enemyTeam, placements,
  phase, gameRound, onPlace, onUnplace, onStart, onRoundEnd, onLevelUp,
}: Props) {
  const [dragOver,   setDragOver]   = useState<number | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [inspected,  setInspected]  = useState<PokemonInstance | null>(null)

  const playerHpRefs           = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const enemyHpRefs            = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const playerAtbRefs          = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const enemyAtbRefs           = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const playerFlashRefs        = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const enemyFlashRefs         = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const playerProcRefs         = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const enemyProcRefs          = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const playerBonusDisplayRefs = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const enemyBonusDisplayRefs  = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const playerCritRefs         = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))
  const enemyCritRefs          = useRef<(HTMLDivElement | null)[]>(Array(NUM_SLOTS).fill(null))

  useEffect(() => {
    setInspected(null)
  }, [phase])

  useEffect(() => {
    if (phase !== 'fighting') return

    const playerCombatants: (CombatPokemon | null)[] = placements.map(i =>
      i !== null ? new CombatPokemon(playerTeam[i]) : null
    )
    const enemyCombatants: (CombatPokemon | null)[] = Array.from({ length: NUM_SLOTS }, (_, i) =>
      enemyTeam[i] ? new CombatPokemon(enemyTeam[i]) : null
    )

    const manager = new CombatManager()
    manager.setupRound(
      playerCombatants, enemyCombatants,
      playerTeam.filter((_, i) => placements.includes(i)),
      enemyTeam,
    )

    manager.on('attack', ({ slotIndex, side, isCritical }) => {
      if (isCritical) {
        const critRef = side === 'player'
          ? playerCritRefs.current[slotIndex]
          : enemyCritRefs.current[slotIndex]
        if (critRef) {
          critRef.style.transition = 'none'
          critRef.style.opacity = '1'
          critRef.style.transform = 'translateX(-50%) scale(1.2)'
          critRef.getBoundingClientRect()
          critRef.style.transition = 'opacity 0.5s ease 0.6s, transform 0.5s ease 0.6s'
          setTimeout(() => {
            critRef.style.opacity = '0'
            critRef.style.transform = 'translateX(-50%) scale(0.8)'
          }, 200)
        }
      }

      const defRef = side === 'player'
        ? enemyFlashRefs.current[slotIndex]
        : playerFlashRefs.current[slotIndex]

      if (defRef) {
        defRef.style.filter = 'brightness(4) saturate(0)'
        setTimeout(() => {
          if (!defRef) return
          const slot = manager.slots[slotIndex]
          const target = side === 'player' ? slot.enemy : slot.player
          if (target?.isDefeated) {
            defRef.style.transition = 'filter 0.5s'
            defRef.style.filter = 'grayscale(1) brightness(0.45)'
          } else {
            defRef.style.filter = ''
          }
        }, 130)
      }
    })

    manager.on('synergy_proc', ({ slotIndex, side, synergyName }) => {
      const ref = side === 'player'
        ? playerProcRefs.current[slotIndex]
        : enemyProcRefs.current[slotIndex]
      if (!ref) return
      ref.textContent = synergyName
      ref.style.transition = 'none'
      ref.style.opacity = '1'
      ref.style.transform = 'translateX(-50%) translateY(0px)'
      ref.getBoundingClientRect()
      ref.style.transition = 'opacity 0.4s, transform 0.4s'
      setTimeout(() => {
        ref.style.opacity = '0'
        ref.style.transform = 'translateX(-50%) translateY(-10px)'
      }, 650)
    })

    manager.on('bonus_change', ({ slotIndex, side, key, delta, allBonuses }) => {
      const displayRef = side === 'player'
        ? playerBonusDisplayRefs.current[slotIndex]
        : enemyBonusDisplayRefs.current[slotIndex]
      if (displayRef) {
        displayRef.innerHTML = ''
        BONUS_KEYS.forEach(k => {
          const val = allBonuses[k]
          if (val === 0) return
          const chip = document.createElement('span')
          chip.textContent = `${BONUS_LABELS[k]}${val > 0 ? '+' : ''}${val}`
          chip.style.cssText = [
            'font-size:7px', 'font-weight:800', 'padding:1px 3px', 'border-radius:2px',
            `background:${val > 0 ? '#0a2a0a' : '#2a0a0a'}`,
            `color:${val > 0 ? '#55dd55' : '#dd5555'}`,
            `border:1px solid ${val > 0 ? '#1a4a1a' : '#4a1a1a'}`,
            'margin-right:2px', 'line-height:1.2', 'display:inline-block',
          ].join(';')
          displayRef.appendChild(chip)
        })
      }
      const animRef = side === 'player'
        ? playerProcRefs.current[slotIndex]
        : enemyProcRefs.current[slotIndex]
      if (animRef) {
        animRef.textContent = `${BONUS_LABELS[key]} ${delta > 0 ? '▲' : '▼'}`
        animRef.style.color = delta > 0 ? '#55ff55' : '#ff5555'
        animRef.style.transition = 'none'
        animRef.style.opacity = '1'
        animRef.style.transform = 'translateX(-50%) translateY(0px)'
        animRef.getBoundingClientRect()
        animRef.style.transition = 'opacity 0.4s, transform 0.4s'
        setTimeout(() => {
          animRef.style.opacity = '0'
          animRef.style.transform = 'translateX(-50%) translateY(-10px)'
        }, 650)
      }
    })

    manager.on('level_up', ({ slotIndex, side, newLevel }) => {
      const ref = side === 'player'
        ? playerProcRefs.current[slotIndex]
        : enemyProcRefs.current[slotIndex]
      if (ref) {
        ref.textContent = `Nv.${newLevel} ▲`
        ref.style.color = '#ffd700'
        ref.style.transition = 'none'
        ref.style.opacity = '1'
        ref.style.transform = 'translateX(-50%) translateY(0px)'
        ref.getBoundingClientRect()
        ref.style.transition = 'opacity 0.6s, transform 0.6s'
        setTimeout(() => {
          ref.style.opacity = '0'
          ref.style.transform = 'translateX(-50%) translateY(-14px)'
        }, 900)
      }
      if (side === 'player') {
        const teamIdx = placements[slotIndex]
        if (teamIdx !== null) onLevelUp?.(teamIdx, newLevel)
      }
    })

    manager.on('round_end', () => {
      cancelAnimationFrame(raf)

      placements.forEach((teamIdx, slotIdx) => {
        if (teamIdx === null) return
        const c = playerCombatants[slotIdx]
        if (c) playerTeam[teamIdx].currentHp = c.currentHp
      })
      enemyCombatants.forEach((c, i) => {
        if (c) enemyTeam[i].currentHp = c.currentHp
      })

      const applyFairy = (team: typeof playerTeam) => {
        const fallen = team.filter(p => p.currentHp <= 0)
        if (fallen.length > 0) {
          fallen[Math.floor(Math.random() * fallen.length)].currentHp = 1
        } else {
          const alive = team.filter(p => p.currentHp > 0)
          if (alive.length > 0) {
            const weakest = alive.reduce((a, b) =>
              (a.currentHp / a.getMaxHp()) <= (b.currentHp / b.getMaxHp()) ? a : b
            )
            weakest.currentHp = Math.min(weakest.getMaxHp(), weakest.currentHp + Math.floor(weakest.getMaxHp() * 0.5))
          }
        }
      }
      const pFairy = manager.getPlayerFairyChance()
      if (pFairy > 0 && Math.random() < pFairy) applyFairy(playerTeam)
      const eFairy = manager.getEnemyFairyChance()
      if (eFairy > 0 && Math.random() < eFairy) applyFairy(enemyTeam)

      setTimeout(() => onRoundEnd({}), 1500)
    })

    manager.round = gameRound
    const playerFallen = playerTeam.filter(p => p.currentHp <= 0).length
    const enemyFallenCount = enemyTeam.filter(p => p.currentHp <= 0).length
    manager.startRound(playerFallen, enemyFallenCount)

    let lastTime = performance.now()
    let raf: number

    const tick = (now: number) => {
      const delta = now - lastTime
      lastTime = now
      manager.tick(delta)

      manager.slots.forEach((slot, i) => {
        if (slot.player) {
          const hp = slot.player.getHpPercent() * 100
          const hpEl = playerHpRefs.current[i]
          if (hpEl) {
            hpEl.style.width = `${hp}%`
            hpEl.style.background = hp > 50 ? '#44dd44' : hp > 25 ? '#ffcc00' : '#ff3333'
          }
          if (playerAtbRefs.current[i])
            playerAtbRefs.current[i]!.style.width = `${slot.player.getAtbPercent()}%`
        }
        if (slot.enemy) {
          const hp = slot.enemy.getHpPercent() * 100
          const hpEl = enemyHpRefs.current[i]
          if (hpEl) {
            hpEl.style.width = `${hp}%`
            hpEl.style.background = hp > 50 ? '#44dd44' : hp > 25 ? '#ffcc00' : '#ff3333'
          }
          if (enemyAtbRefs.current[i])
            enemyAtbRefs.current[i]!.style.width = `${slot.enemy.getAtbPercent()}%`
        }
      })

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const handleStartClick = () => {
    setShowBanner(true)
    setTimeout(() => {
      setShowBanner(false)
      onStart()
    }, 2000)
  }

  const isFighting = phase === 'fighting'
  const canStart   = placements.some(p => p !== null)

  return (
    <div className={`${styles.container} ${isFighting ? styles.locked : ''}`}>

      {showBanner && <RoundStartBanner />}

      <div className={styles.header}>
        <span className={styles.phaseLabel}>
          {isFighting ? '⚔ Combate' : 'Posiciona tu equipo'}
          <span className={styles.roundCounter}> — Round {gameRound}</span>
        </span>
        <button
          className={styles.startBtn}
          disabled={!canStart || isFighting || showBanner}
          onClick={handleStartClick}
          style={{ pointerEvents: 'auto' }}
        >
          <svg viewBox="0 0 72 22" width="72" height="22" style={{ display: 'block' }}>
            <text x="36" y="16" textAnchor="middle" fontSize="16" fontWeight="900"
              fontFamily="Arial Black, Impact, sans-serif"
              fill="#e63946" stroke="#ffd700" strokeWidth="2.5" paintOrder="stroke"
              letterSpacing="1">START</text>
          </svg>
        </button>
      </div>

      <div className={styles.zones}>
        {Array.from({ length: NUM_SLOTS }, (_, slotIdx) => {
          const teamIdx   = placements[slotIdx]
          const player    = teamIdx !== null ? playerTeam[teamIdx] : null
          const enemy     = enemyTeam[slotIdx] ?? null
          const enemyAlive = !!enemy && enemy.currentHp > 0

          const isDropTarget = !isFighting && enemyAlive

          return (
            <div
              key={slotIdx}
              className={styles.slot}
              onDragOver={isDropTarget ? e => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOver(slotIdx)
              } : undefined}
              onDragLeave={isDropTarget ? e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null)
              } : undefined}
              onDrop={isDropTarget ? e => {
                e.preventDefault(); setDragOver(null)
                const ti = parseInt(e.dataTransfer.getData('teamIndex'), 10)
                if (!isNaN(ti)) onPlace(slotIdx, ti)
              } : undefined}
            >

              {/* ── LADO JUGADOR ── */}
              {isFighting ? (
                <div className={styles.combatPlayerSide}>
                  <div
                    ref={el => { playerFlashRefs.current[slotIdx] = el }}
                    className={styles.combatSpriteWrap}
                  >
                    {player && <PokemonSprite id={player.data.id} className={styles.combatSprite} style={getSpriteStyle(player.data, true)} />}
                    <div ref={el => { playerProcRefs.current[slotIdx] = el }} className={styles.procLabel} />
                    <div ref={el => { playerCritRefs.current[slotIdx] = el }} className={styles.critLabel}>
                      <svg viewBox="0 0 90 22" width="90" height="22"><text x="45" y="16" textAnchor="middle" fontSize="14" fontWeight="900" fontFamily="Arial Black,Impact,sans-serif" fill="#e63946" stroke="#ffd700" strokeWidth="2.5" paintOrder="stroke">¡CRÍTICO!</text></svg>
                    </div>
                  </div>
                  <div className={styles.combatPlayerContent}>
                    {player ? <>
                      <div className={styles.combatBars}>
                        <div className={styles.barBg}>
                          <div ref={el => { playerHpRefs.current[slotIdx] = el }} className={styles.hpFill} />
                        </div>
                        <div className={styles.barBg}>
                          <div ref={el => { playerAtbRefs.current[slotIdx] = el }} className={styles.atbFill} />
                        </div>
                      </div>
                      <div className={styles.combatTypeRow}>
                        <TypeBadges types={player.data.types} />
                      </div>
                      <div className={styles.combatNameRow}>
                        <span className={styles.combatName}>{player.data.name}</span>
                        <span className={styles.combatLevel}>Nv.{player.level}</span>
                        {player.equippedItem && <ItemIcon item={player.equippedItem} size={14} />}
                      </div>
                      <div className={styles.combatBonusRow}>
                        <div ref={el => { playerBonusDisplayRefs.current[slotIdx] = el }} />
                      </div>
                    </> : (
                      <span className={styles.emptyLabel}>—</span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`${styles.playerSide} ${isDropTarget ? styles.dropTarget : ''} ${isDropTarget && dragOver === slotIdx ? styles.over : ''}`}
                >
                  {player ? (
                    <div className={styles.placedCard}>
                      <div className={styles.spriteWithBars}>
                        <PokemonSprite id={player.data.id} className={styles.cardSprite} style={getSpriteStyle(player.data, true)} />
                        <div className={styles.barsOverlay}>
                          <div className={styles.barBg}>
                            <div className={styles.hpFill} style={{ width: `${(player.currentHp / player.getMaxHp()) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className={styles.cardInfo}>
                        <div className={styles.cardName}>{player.data.name}</div>
                        <div className={styles.cardLv}>Nv.{player.level}</div>
                        <TypeBadges types={player.data.types} />
                        {player.equippedItem && <ItemIcon item={player.equippedItem} size={16} style={{ marginTop: 2 }} />}
                      </div>
                      <div className={styles.cardActions}>
                        <InfoBtn onClick={() => setInspected(player)} />
                        <button className={styles.removeBtn} onClick={() => onUnplace(slotIdx)}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <span className={styles.emptyLabel}>Hueco libre</span>
                  )}
                </div>
              )}

              <VsDivider />

              {/* ── LADO ENEMIGO ── */}
              {isFighting ? (
                <div className={styles.combatEnemySide}>
                  <div
                    ref={el => { enemyFlashRefs.current[slotIdx] = el }}
                    className={styles.combatEnemySpriteWrap}
                  >
                    {enemy && <PokemonSprite id={enemy.data.id} className={styles.combatEnemySprite} style={getSpriteStyle(enemy.data, false)} />}
                    <div ref={el => { enemyProcRefs.current[slotIdx] = el }} className={styles.procLabel} />
                    <div ref={el => { enemyCritRefs.current[slotIdx] = el }} className={styles.critLabel}>
                      <svg viewBox="0 0 90 22" width="90" height="22"><text x="45" y="16" textAnchor="middle" fontSize="14" fontWeight="900" fontFamily="Arial Black,Impact,sans-serif" fill="#e63946" stroke="#ffd700" strokeWidth="2.5" paintOrder="stroke">¡CRÍTICO!</text></svg>
                    </div>
                  </div>
                  <div className={styles.combatEnemyContent}>
                    {enemy ? <>
                      <div className={styles.combatEnemyBars}>
                        <div className={styles.barBg}>
                          <div ref={el => { enemyHpRefs.current[slotIdx] = el }} className={styles.hpFill} />
                        </div>
                        <div className={styles.barBg}>
                          <div ref={el => { enemyAtbRefs.current[slotIdx] = el }} className={styles.atbFill} />
                        </div>
                      </div>
                      <div className={styles.combatEnemyTypeRow}>
                        <TypeBadges types={enemy.data.types} />
                      </div>
                      <div className={styles.combatEnemyNameRow}>
                        {enemy.equippedItem && <ItemIcon item={enemy.equippedItem} size={14} />}
                        <span className={styles.combatName}>{enemy.data.name}</span>
                        <span className={styles.combatLevel}>Nv.{enemy.level}</span>
                      </div>
                      <div className={styles.combatEnemyBonusRow}>
                        <div ref={el => { enemyBonusDisplayRefs.current[slotIdx] = el }} />
                      </div>
                    </> : (
                      <span className={styles.emptyLabel}>—</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.enemySide}>
                  {enemy ? (
                    <div className={`${styles.enemyCard} ${!enemyAlive ? styles.fainted : ''}`}>
                      <div className={styles.spriteWithBars}>
                        <PokemonSprite
                          id={enemy.data.id}
                          className={styles.enemySprite}
                          style={getSpriteStyle(enemy.data, false)}
                          paused={!enemyAlive}
                        />
                        <div className={styles.barsOverlay}>
                          <div className={styles.barBg}>
                            {enemyAlive && (
                              <div className={styles.hpFill} style={{
                                width: `${(enemy.currentHp / enemy.getMaxHp()) * 100}%`,
                                background: (enemy.currentHp / enemy.getMaxHp()) > 0.5 ? '#44dd44'
                                  : (enemy.currentHp / enemy.getMaxHp()) > 0.25 ? '#ffcc00' : '#ff3333',
                              }} />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.enemyInfo}>
                        <div className={styles.enemyName}>{enemy.data.name}</div>
                        <div className={styles.cardLv}>Nv.{enemy.level}</div>
                        <TypeBadges types={enemy.data.types} />
                        {enemy.equippedItem && <ItemIcon item={enemy.equippedItem} size={16} style={{ marginTop: 2 }} />}
                      </div>
                      <InfoBtn onClick={() => setInspected(enemy)} />
                    </div>
                  ) : (
                    <span className={styles.emptyLabel}>—</span>
                  )}
                </div>
              )}

            </div>
          )
        })}
      </div>

      {inspected && (
        <PokemonInfoModal pokemon={inspected} onClose={() => setInspected(null)} />
      )}
    </div>
  )
}
