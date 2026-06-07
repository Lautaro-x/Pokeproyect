import { useEffect, useState } from 'react'
import styles from './EvolutionModal.module.css'
import { PokemonSprite } from './PokemonSprite'
import type { PokemonData } from '../types'

interface Props {
  currentData: PokemonData
  choices:     PokemonData[]
  onComplete:  (chosen: PokemonData) => void
}

export function EvolutionModal({ currentData, choices, onComplete }: Props) {
  const single = choices.length === 1 ? choices[0] : null
  const [chosen, setChosen] = useState<PokemonData | null>(single)
  const [phase,  setPhase]  = useState<'choosing' | 'out' | 'in' | 'done'>(
    single ? 'out' : 'choosing'
  )

  useEffect(() => {
    if (!single) return
    const t1 = setTimeout(() => setPhase('in'),   1200)
    const t2 = setTimeout(() => setPhase('done'), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [single])

  const handleChoice = (data: PokemonData) => {
    setChosen(data)
    setPhase('out')
    setTimeout(() => setPhase('in'),   1200)
    setTimeout(() => setPhase('done'), 2600)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>

        {phase === 'choosing' ? (
          <>
            <p className={styles.title}>¡{currentData.name} puede evolucionar!</p>
            <p className={styles.subtitle}>¿En qué deseas que evolucione?</p>
            <div className={styles.choiceGrid}>
              {choices.map(c => (
                <button key={c.id} className={styles.choiceCard} onClick={() => handleChoice(c)}>
                  <PokemonSprite id={c.id} className={styles.choiceSprite} />
                  <span className={styles.choiceName}>{c.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className={styles.title}>
              {phase === 'done'
                ? `¡${chosen!.name} ha evolucionado!`
                : `¡${currentData.name} está evolucionando!`}
            </p>

            <div className={styles.spriteStage}>
              {phase === 'out' && (
                <div className={styles.zoomOut}>
                  <PokemonSprite id={currentData.id} className={styles.sprite} />
                </div>
              )}
              {(phase === 'in' || phase === 'done') && (
                <div className={phase === 'in' ? styles.zoomIn : styles.spriteStatic}>
                  <PokemonSprite id={chosen!.id} className={styles.sprite} />
                </div>
              )}
            </div>

            <div className={styles.names}>
              {phase !== 'done'
                ? <span className={styles.oldName}>{currentData.name}</span>
                : <span className={styles.newName}>{chosen!.name}</span>
              }
            </div>

            {phase === 'done' && (
              <button className={styles.continueBtn} onClick={() => onComplete(chosen!)}>
                Continuar
              </button>
            )}
          </>
        )}

      </div>
    </div>
  )
}
