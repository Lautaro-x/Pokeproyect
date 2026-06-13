import { useState, useMemo } from 'react'
import styles from './ScenePicker.module.css'
import type { SceneData } from '../../game/utils/sceneTypes'

interface Props {
  scenes: SceneData[]
  onSelect: (scene: SceneData) => void
  onBack: () => void
}

const REGION_LABEL: Record<string, string> = {
  kanto:   'Kanto',
  johto:   'Johto',
  hoenn:   'Hoenn',
  sinnoh:  'Sinnoh',
  teselia: 'Teselia',
  kalos:   'Kalos',
  galar:   'Galar',
  paldea:  'Paldea',
}

function getRegion(scene_id: string): string {
  return scene_id.split('_')[0]
}

export function ScenePicker({ scenes, onSelect, onBack }: Props) {
  const [search,       setSearch]       = useState('')
  const [activeRegion, setActiveRegion] = useState<string>('all')

  const regions = useMemo(() => {
    const seen = new Set<string>()
    for (const s of scenes) seen.add(getRegion(s.scene_id))
    return [...seen]
  }, [scenes])

  const filtered = useMemo(() => scenes.filter(s => {
    const matchRegion = activeRegion === 'all' || getRegion(s.scene_id) === activeRegion
    const matchSearch = s.scene_name.toLowerCase().includes(search.toLowerCase())
    return matchRegion && matchSearch
  }), [scenes, activeRegion, search])

  return (
    <div className={styles.picker}>

      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar escena..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.navBar}>
        <button
          className={`${styles.navBtn} ${activeRegion === 'all' ? styles.navBtnActive : ''}`}
          onClick={() => setActiveRegion('all')}
        >
          Todas
        </button>
        {regions.map(region => (
          <button
            key={region}
            className={`${styles.navBtn} ${activeRegion === region ? styles.navBtnActive : ''}`}
            onClick={() => setActiveRegion(region)}
          >
            {REGION_LABEL[region] ?? region}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>Sin resultados</p>
        ) : (
          <div className={styles.grid}>
            {filtered.map(scene => (
              <button
                key={scene.scene_id}
                className={styles.sceneBtn}
                onClick={() => onSelect(scene)}
              >
                {scene.scene_name}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
