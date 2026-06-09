import { useState, useMemo } from 'react'
import styles from './HistoryStarts.module.css'
import modalStyles from '../../components/PokemonInfoModal.module.css'
import { PokemonSprite } from '../../components/PokemonSprite'
import { TypeBadges } from '../../components/TypeBadge'
import { PokemonInfoModal } from '../../components/PokemonInfoModal'
import { PokemonInstance } from '../../game/entities/PokemonInstance'
import { useGame } from '../../context/GameContext'
import type { PokemonData } from '../../types'

export interface Professor {
  gen:      number
  region:   string
  name:     string
  gender:   'male' | 'female' | 'plural'
  image:    string
  starters: number[]
}

interface Props {
  professor: Professor
  starters:  PokemonData[]
  onDone:    () => void
}

function buildMessage(prof: Professor): string {
  const { name, gender, region } = prof
  if (gender === 'plural')
    return `¡Hola! Somos los ${name}, tu aventura está a punto de empezar en ${region}, ¡te presentamos a estos pequeños, elige a tu compañero!`
  const article = gender === 'female' ? 'la' : 'el'
  return `¡Hola! Soy ${article} ${name}, tu aventura está a punto de empezar en ${region}, ¡te presento a estos pequeños, elige a tu compañero!`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function HistoryStarts({ professor, starters, onDone }: Props) {
  const { requestAddPokemon } = useGame()

  const [selected, setSelected] = useState<PokemonData | null>(null)
  const [chosen,   setChosen]   = useState(false)

  const selectedInstance = useMemo(
    () => selected ? new PokemonInstance(selected, 5) : null,
    [selected]
  )

  const handleAdd = () => {
    if (!selectedInstance) return
    setSelected(null)
    setChosen(true)
    requestAddPokemon(selectedInstance)
  }

  const modalFooter = selectedInstance && (
    <div className={modalStyles.footerActions}>
      <button className={modalStyles.footerBackBtn} onClick={() => setSelected(null)}>← Volver</button>
      <button className={modalStyles.footerAddBtn}  onClick={handleAdd}>Agregar</button>
    </div>
  )

  return (
    <div className={styles.scene}>
      {selectedInstance && (
        <PokemonInfoModal
          pokemon={selectedInstance}
          onClose={() => setSelected(null)}
          footer={modalFooter}
        />
      )}
      {/* ── Professor ── */}
      <div className={styles.professorArea}>
        <img
          src={`/sprites/professor/${professor.image}`}
          alt={professor.name}
          className={styles.professorImg}
          draggable={false}
        />
      </div>

      {/* ── Dialog panel ── */}
      <div className={styles.dialog}>
        {chosen ? (
          <div className={styles.finalState}>
            <p className={styles.finalMsg}>¡Que inicie tu aventura!</p>
            <button className={styles.advanceBtn} onClick={onDone}>
              ¡Adelante!
            </button>
          </div>
        ) : (
          <>
            <p className={styles.message}>{buildMessage(professor)}</p>
            <div className={styles.starterRow}>
              {starters.map(pokemon => (
                <button
                  key={pokemon.id}
                  className={styles.starterCard}
                  onClick={() => setSelected(pokemon)}
                >
                  <PokemonSprite id={pokemon.id} style={{ width: 72, height: 72 }} />
                  <span className={styles.starterName}>{capitalize(pokemon.name)}</span>
                  <TypeBadges types={pokemon.types} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
