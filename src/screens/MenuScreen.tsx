import { useNavigate } from 'react-router-dom'
import styles from './MenuScreen.module.css'

function MenuScreen() {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>PokéProyect</h1>
        <p className={styles.subtitle}>Fan Game</p>
      </div>

      <nav className={styles.menu}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => navigate('/combat-test')}
        >
          Combate Test
        </button>
      </nav>
    </div>
  )
}

export default MenuScreen
