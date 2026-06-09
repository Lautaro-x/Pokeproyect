import styles from './PokemonCenter.module.css'
import { useGame } from '../../context/GameContext'

interface Props {
  onDone: () => void
  onBack: () => void
}

export function PokemonCenter({ onDone, onBack }: Props) {
  const { healTeam } = useGame()

  const handleHeal = () => {
    healTeam()
    onDone()
  }

  return (
    <div className={styles.scene}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
        <span className={styles.title}>Centro Pokémon</span>
      </div>

      <div className={styles.scenery}>
        <img src="/scenery/pokecenter.png" alt="" className={styles.sceneImg} draggable={false} />
      </div>

      <div className={styles.content}>
        <button className={styles.healBtn} onClick={handleHeal}>
          Curar
        </button>
      </div>
    </div>
  )
}
