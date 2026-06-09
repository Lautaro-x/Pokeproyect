import { useNavigate } from 'react-router-dom'
import styles from './HistoriaScreen.module.css'

const REGIONS = [
  { id: 'kanto',   name: 'Kanto',   genLabel: 'Gen I',    gen: 1, unlocked: true  },
  { id: 'johto',   name: 'Johto',   genLabel: 'Gen II',   gen: 2, unlocked: false },
  { id: 'hoenn',   name: 'Hoenn',   genLabel: 'Gen III',  gen: 3, unlocked: false },
  { id: 'sinnoh',  name: 'Sinnoh',  genLabel: 'Gen IV',   gen: 4, unlocked: false },
  { id: 'teselia', name: 'Teselia', genLabel: 'Gen V',    gen: 5, unlocked: false },
  { id: 'kalos',   name: 'Kalos',   genLabel: 'Gen VI',   gen: 6, unlocked: false },
  { id: 'galar',   name: 'Galar',   genLabel: 'Gen VIII', gen: 8, unlocked: false },
  { id: 'paldea',  name: 'Paldea',  genLabel: 'Gen IX',   gen: 9, unlocked: false },
]

export default function HistoriaScreen() {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => navigate('/')}>
        ← Volver
      </button>

      <div className={styles.header}>
        <h1 className={styles.title}>Modo Historia</h1>
        <p className={styles.subtitle}>Elige una región para comenzar</p>
      </div>

      <div className={styles.grid}>
        {REGIONS.map(region => (
          <button
            key={region.id}
            className={`${styles.regionCard} ${region.unlocked ? styles.unlocked : styles.locked}`}
            disabled={!region.unlocked}
            onClick={() => region.unlocked && navigate('/history', { state: { region: region.id, gen: region.gen } })}
          >
            <span className={styles.regionGen}>{region.genLabel}</span>
            <span className={styles.regionName}>{region.name}</span>
            {!region.unlocked && <span className={styles.lockIcon}>🔒</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
