import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './MenuScreen.module.css'
import { hasSave, peekSave, MODE_LABELS } from '../game/utils/saveGame'
import { PokedexButton } from '../components/PokedexModal'
import { REGIONS, isHistoriaUnlocked } from '../game/utils/unlockedModes'

function MenuScreen() {
  const navigate = useNavigate()
  const [showRegionModal, setShowRegionModal] = useState(false)

  const historiaSave = hasSave('historia') ? peekSave('historia') : null

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>PokéProyect</h1>
        <p className={styles.subtitle}>Fan Game</p>
      </div>

      <nav className={styles.menu}>
        {historiaSave && (
          <button
            className={`${styles.btn} ${styles.btnContinue}`}
            onClick={() => navigate('/history', { state: { resume: true } })}
          >
            <span className={styles.continueLabel}>Continuar</span>
            <span className={styles.continueSub}>
              {MODE_LABELS['historia']} · Mapa {historiaSave.mapNumber}
            </span>
          </button>
        )}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setShowRegionModal(true)}
        >
          {MODE_LABELS['historia']}
        </button>

        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => navigate('/test-env')}
        >
          Entorno de Test
        </button>

        <PokedexButton className={`${styles.btn} ${styles.btnSecondary}`} />
      </nav>

      {showRegionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRegionModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Modo Historia</h2>
            <p className={styles.modalSub}>Elige una región para comenzar</p>
            <div className={styles.regionGrid}>
              {REGIONS.map(region => {
                const unlocked = isHistoriaUnlocked(region.id)
                return (
                  <button
                    key={region.id}
                    className={`${styles.regionCard} ${unlocked ? styles.regionUnlocked : styles.regionLocked}`}
                    disabled={!unlocked}
                    onClick={() => {
                      setShowRegionModal(false)
                      navigate('/history', { state: { region: region.id, gen: region.gen } })
                    }}
                  >
                    <span className={styles.regionGen}>{region.genLabel}</span>
                    <span className={styles.regionName}>{region.name}</span>
                    {!unlocked && <span className={styles.lockIcon}>🔒</span>}
                  </button>
                )
              })}
            </div>
            <button className={styles.modalClose} onClick={() => setShowRegionModal(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MenuScreen
