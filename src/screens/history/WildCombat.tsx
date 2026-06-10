import { useState, useCallback } from 'react'
import styles from './WildCombat.module.css'
import { CombatArea } from '../combat/CombatArea'
import { useGame } from '../../context/GameContext'
import type { PokemonInstance } from '../../game/entities/PokemonInstance'
import type { GamePhase } from '../GameLayout'

interface Props {
  enemyTeam:   PokemonInstance[]
  placements:  (number | null)[]
  phase:       GamePhase
  onPlace:     (slot: number, teamIdx: number) => void
  onUnplace:   (slot: number) => void
  onStart:     () => void
  onNextRound: () => void
  onWin:       () => void
  onLose:      () => void
}

export function WildCombat({
  enemyTeam,
  placements, phase,
  onPlace, onUnplace, onStart, onNextRound,
  onWin, onLose,
}: Props) {
  const { playerTeam, setPlayerTeam } = useGame()

  const [round,  setRound]  = useState(1)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)

  const handleLevelUp = useCallback(() => {
    setPlayerTeam(prev => [...prev])
  }, [setPlayerTeam])

  const handleRoundEnd = () => {
    const allEnemiesDead    = enemyTeam.every(p => p.currentHp <= 0)
    const allPlayersFainted = playerTeam.every(p => p.currentHp <= 0)

    if (allEnemiesDead)    { setResult('win');  return }
    if (allPlayersFainted) { setResult('lose'); return }

    onNextRound()
    setRound(r => r + 1)
  }

  return (
    <div className={styles.wrapper}>
      <CombatArea
        key={round}
        playerTeam={playerTeam}
        enemyTeam={enemyTeam}
        placements={placements}
        phase={phase}
        gameRound={round}
        onPlace={onPlace}
        onUnplace={onUnplace}
        onStart={onStart}
        onRoundEnd={handleRoundEnd}
        onLevelUp={handleLevelUp}
      />

      {result && (
        <div className={styles.overlay}>
          <span className={styles.resultLabel}>
            {result === 'win' ? '¡Victoria!' : '¡Derrota!'}
          </span>
          <button className={styles.resultBtn} onClick={result === 'win' ? onWin : onLose}>
            Continuar
          </button>
        </div>
      )}
    </div>
  )
}
