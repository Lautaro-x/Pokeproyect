import { useNavigate } from 'react-router-dom'
import styles from './MenuScreen.module.css'
import { hasSave, peekSave, MODE_LABELS } from '../game/utils/saveGame'

function MenuScreen() {
  const navigate = useNavigate()

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
            onClick={() => navigate('/historia', { state: { resume: true } })}
          >
            <span className={styles.continueLabel}>Continuar</span>
            <span className={styles.continueSub}>
              {MODE_LABELS['historia']} · Mapa {historiaSave.mapNumber}
            </span>
          </button>
        )}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => navigate('/historia')}
        >
          {MODE_LABELS['historia']}
        </button>

        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => navigate('/test-env')}
        >
          Entorno de Test
        </button>
      </nav>
    </div>
  )
}

export default MenuScreen
