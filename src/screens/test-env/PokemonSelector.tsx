import { useState, useMemo } from 'react'
import styles from './PokemonSelector.module.css'
import allPokemon from '../../assets/pokemon.json'
import type { PokemonData } from '../../types'

const DB = allPokemon as PokemonData[]

function formatName(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatId(id: number): string {
  return String(id).padStart(3, '0')
}

function groupByGeneration(list: PokemonData[]): Map<number, PokemonData[]> {
  const map = new Map<number, PokemonData[]>()
  for (const p of list) {
    const gen = p.generation
    if (!map.has(gen)) map.set(gen, [])
    map.get(gen)!.push(p)
  }
  return map
}

const GEN_LABEL: Record<number, string> = {
  1: 'Gen I — Kanto',
  2: 'Gen II — Johto',
  3: 'Gen III — Hoenn',
  4: 'Gen IV — Sinnoh',
  5: 'Gen V — Teselia',
  6: 'Gen VI — Kalos',
  7: 'Gen VII — Alola',
  8: 'Gen VIII — Galar',
  9: 'Gen IX — Paldea',
}

interface Props {
  onBack:                () => void
  onPokemonRemove?:      (teamIdx: number) => void
  onEnemyPokemonRemove?: (teamIdx: number) => void
}

export function PokemonSelector({ onBack, onPokemonRemove, onEnemyPokemonRemove }: Props) {
  const [level,       setLevel]       = useState(50)
  const [shiny,       setShiny]       = useState(false)
  const [releaseOver, setReleaseOver] = useState(false)

  const groups    = useMemo(() => groupByGeneration(DB), [])
  const sortedGens = useMemo(() => [...groups.keys()].sort((a, b) => a - b), [groups])

  return (
    <div className={styles.selector}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
        <label className={styles.controlLabel}>
          Nivel
          <input
            type="number"
            min={1}
            max={100}
            value={level}
            onChange={e => setLevel(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
            className={styles.levelInput}
          />
        </label>
        <label className={styles.controlLabel}>
          <input
            type="checkbox"
            checked={shiny}
            onChange={e => setShiny(e.target.checked)}
            className={styles.shinyCheck}
          />
          Shiny
        </label>
      </div>

      <div className={styles.list}>
        {sortedGens.map(gen => (
          <details key={gen} className={styles.genGroup}>
            <summary className={styles.genHeader}>
              {GEN_LABEL[gen] ?? `Gen ${gen}`}
              <span className={styles.genCount}>{groups.get(gen)!.length}</span>
            </summary>
            <div className={styles.chips}>
              {groups.get(gen)!.map(pokemon => (
                <div
                  key={pokemon.id}
                  className={styles.chip}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData(
                      'pokemondrag',
                      JSON.stringify({ id: pokemon.id, level, shiny })
                    )
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                >
                  {formatId(pokemon.id)} — {formatName(pokemon.name)}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div
        className={`${styles.releaseZone} ${releaseOver ? styles.releaseOver : ''}`}
        onDragOver={e => {
          if (e.dataTransfer.types.includes('teamindex')) {
            e.preventDefault()
            setReleaseOver(true)
          }
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setReleaseOver(false)
        }}
        onDrop={e => {
          e.preventDefault()
          setReleaseOver(false)
          const idx = e.dataTransfer.getData('teamIndex')
          const teamSide = e.dataTransfer.getData('teamside')
          if (idx === '') return
          if (teamSide === 'enemy') onEnemyPokemonRemove?.(parseInt(idx))
          else onPokemonRemove?.(parseInt(idx))
        }}
      >
        Soltar aquí para liberar
      </div>
    </div>
  )
}
