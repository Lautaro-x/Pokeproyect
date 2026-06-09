import styles from './TeamFullModal.module.css'
import { useGame } from '../context/GameContext'
import { officialArtwork } from '../game/utils/spriteUrl'

export function TeamFullModal() {
  const { playerTeam, pendingAddPokemon, confirmReplace } = useGame()
  if (!pendingAddPokemon) return null

  return (
    <div className={styles.overlay}>
      <p className={styles.question}>
        El equipo está lleno.<br />
        ¿A quién sustituir por <strong>{pendingAddPokemon.data.name}</strong>?
      </p>
      <div className={styles.grid}>
        {playerTeam.map((p, idx) => (
          <button key={idx} className={styles.card} onClick={() => confirmReplace(idx)}>
            <img className={styles.sprite} src={officialArtwork(p.data.id)} alt={p.data.name} />
            <span className={styles.name}>{p.data.name}</span>
            <span className={styles.level}>Nv. {p.level}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
