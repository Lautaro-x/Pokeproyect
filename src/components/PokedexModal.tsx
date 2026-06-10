import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import styles from './PokedexModal.module.css'
import { officialArtwork } from '../game/utils/spriteUrl'
import { readPokedex } from '../game/utils/pokedex'
import type { PokedexEntry } from '../game/utils/pokedex'
import { TypeBadge } from './TypeBadge'
import type { PokemonData } from '../types'
import allPokemon from '../assets/pokemon.json'

const DB = (allPokemon as PokemonData[]).slice().sort((a, b) => a.id - b.id)
const NON_MEGA_TOTAL = DB.filter(p => !p.is_mega).length

type Filter = 'all' | 'obtained' | 'shiny'

function padId(n: number) { return '#' + String(n).padStart(3, '0') }

const STAT_KEYS = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'] as const
const STAT_LABEL: Record<typeof STAT_KEYS[number], string> = {
  hp: 'HP', attack: 'ATK', defense: 'DEF',
  special_attack: 'SpA', special_defense: 'SpD', speed: 'SPD',
}
const STAT_COLOR: Record<typeof STAT_KEYS[number], string> = {
  hp: '#ff5959', attack: '#f5ac78', defense: '#faf378',
  special_attack: '#9db7f5', special_defense: '#a7db8d', speed: '#fa92b2',
}
const STAT_MAX = 200

const GEN_LABEL: Record<number, string> = {
  1: 'Kanto', 2: 'Johto', 3: 'Hoenn', 4: 'Sinnoh',
  5: 'Teselia', 6: 'Kalos', 7: 'Alola', 8: 'Galar', 9: 'Paldea',
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function PokedexDetail({ pokemon, entry, registry, onClose, onSelect }: {
  pokemon: PokemonData
  entry: PokedexEntry | undefined
  registry: Record<number, PokedexEntry>
  onClose: () => void
  onSelect: (p: PokemonData) => void
}) {
  const gotNormal = entry?.obtenido_normal ?? false
  const gotShiny  = entry?.obtenido_shiny  ?? false
  const hallFame  = entry?.hall_fame_history_mode ?? 0
  const isCaught = (name: string) => {
    const p = DB.find(pk => pk.name === name)
    if (!p) return false
    const e = registry[p.id]
    return e?.obtenido_normal || e?.obtenido_shiny
  }
  const nonMegaEvos = pokemon.evolutions.filter(e => e.trigger !== 'mega' && isCaught(e.to_name))
  const megaEvos    = pokemon.evolutions.filter(e => e.trigger === 'mega'  && isCaught(e.to_name))
  const preEvos     = DB.filter(p =>
    p.evolutions.some(e => e.to_name === pokemon.name) && isCaught(p.name)
  )

  return (
    <div className={styles.detail}>
      <button className={styles.detailClose} onClick={onClose}>✕</button>

      <img className={styles.detailArtwork} src={officialArtwork(pokemon.id)} alt={pokemon.name} />

      <div className={styles.detailId}>{padId(pokemon.id)}</div>
      <div className={styles.detailName}>{pokemon.name}</div>

      <div className={styles.detailTypes}>
        {pokemon.types.map(t => <TypeBadge key={t} type={t} />)}
      </div>

      <div className={styles.detailMeta}>
        <span className={styles.detailMetaChip}>Gen {pokemon.generation} · {GEN_LABEL[pokemon.generation] ?? '?'}</span>
        {pokemon.is_legendary && <span className={styles.detailBadge}>Legendario</span>}
        {pokemon.is_mythical  && <span className={styles.detailBadge}>Mítico</span>}
        {pokemon.is_mega      && <span className={styles.detailBadgeMega}>Mega</span>}
      </div>

      <div className={styles.detailDivider} />

      {/* ── Registro Pokédex ── */}
      <div className={styles.detailSectionTitle}>REGISTRO</div>
      <div className={styles.detailRow}>
        <span className={styles.detailRowLabel}>Normal</span>
        <span className={gotNormal ? styles.detailYes : styles.detailNo}>
          {gotNormal ? 'Obtenido' : '—'}
        </span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailRowLabel}>Shiny</span>
        <span className={gotShiny ? styles.detailYesShiny : styles.detailNo}>
          {gotShiny ? 'Obtenido' : '—'}
        </span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailRowLabel}>Hall of Fame</span>
        <span className={hallFame > 0 ? styles.detailHallFame : styles.detailNo}>
          {hallFame > 0 ? `x${hallFame}` : '—'}
        </span>
      </div>

      <div className={styles.detailDivider} />

      {/* ── Estadísticas base ── */}
      <div className={styles.detailSectionTitle}>ESTADÍSTICAS BASE</div>
      {STAT_KEYS.map(key => {
        const val = pokemon.stats[key]
        const pct = Math.min(100, (val / STAT_MAX) * 100)
        return (
          <div key={key} className={styles.detailStatRow}>
            <span className={styles.detailStatLabel}>{STAT_LABEL[key]}</span>
            <div className={styles.detailBarBg}>
              <div className={styles.detailBarFill} style={{ width: `${pct}%`, background: STAT_COLOR[key] }} />
            </div>
            <span className={styles.detailStatValue}>{val}</span>
          </div>
        )
      })}
      <div className={styles.detailRow} style={{ marginTop: 6 }}>
        <span className={styles.detailRowLabel}>Categoría atk</span>
        <span className={styles.detailRowValue}>
          {pokemon.attack_category === 'physical' ? 'Físico' : 'Especial'}
        </span>
      </div>

      {(preEvos.length > 0 || nonMegaEvos.length > 0 || megaEvos.length > 0) && (
        <>
          <div className={styles.detailDivider} />
          {preEvos.length > 0 && (
            <>
              <div className={styles.detailSectionTitle}>PRE-EVOLUCIONES</div>
              {preEvos.map(p => (
                <div
                  key={p.id}
                  className={`${styles.detailEvoRow} ${styles.detailEvoClickable}`}
                  onClick={() => onSelect(p)}
                >
                  <span className={styles.detailEvoArrow}>←</span>
                  <span className={styles.detailEvoName}>{p.name}</span>
                </div>
              ))}
              {(nonMegaEvos.length > 0 || megaEvos.length > 0) && <div style={{ height: 8 }} />}
            </>
          )}
          {nonMegaEvos.length > 0 && (
            <>
              <div className={styles.detailSectionTitle}>EVOLUCIONES</div>
              {nonMegaEvos.map((evo, i) => {
                const evoPokemon = DB.find(p => p.name === evo.to_name)
                return (
                  <div
                    key={i}
                    className={`${styles.detailEvoRow} ${evoPokemon ? styles.detailEvoClickable : ''}`}
                    onClick={evoPokemon ? () => onSelect(evoPokemon) : undefined}
                  >
                    <span className={styles.detailEvoArrow}>→</span>
                    <span className={styles.detailEvoName}>{evo.to_name}</span>
                    <span className={styles.detailEvoTrigger}>
                      {evo.trigger === 'level' ? `Nv. ${evo.level}` : evo.trigger}
                    </span>
                  </div>
                )
              })}
            </>
          )}
          {megaEvos.length > 0 && (
            <>
              {nonMegaEvos.length > 0 && <div style={{ height: 8 }} />}
              <div className={styles.detailSectionTitle}>FORMAS MEGA</div>
              {megaEvos.map((evo, i) => {
                const evoPokemon = DB.find(p => p.name === evo.to_name)
                return (
                  <div
                    key={i}
                    className={`${styles.detailEvoRow} ${evoPokemon ? styles.detailEvoClickable : ''}`}
                    onClick={evoPokemon ? () => onSelect(evoPokemon) : undefined}
                  >
                    <span className={styles.detailEvoArrow}>→</span>
                    <span className={`${styles.detailEvoName} ${styles.detailEvoMega}`}>{evo.to_name}</span>
                    <span className={styles.detailEvoTrigger}>Mega</span>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps { onClose: () => void }

function PokedexModal({ onClose }: ModalProps) {
  const [filter,   setFilter]   = useState<Filter>('all')
  const [selected, setSelected] = useState<PokemonData | null>(null)
  const [search,   setSearch]   = useState('')
  const registry = useMemo(() => readPokedex(), [])

  const obtainedCount = useMemo(
    () => DB.filter(p => !p.is_mega && (registry[p.id]?.obtenido_normal || registry[p.id]?.obtenido_shiny)).length,
    [registry],
  )

  const visible = useMemo(() => {
    let list = DB
    if (filter === 'obtained') list = list.filter(p => registry[p.id]?.obtenido_normal || registry[p.id]?.obtenido_shiny)
    if (filter === 'shiny')    list = list.filter(p => registry[p.id]?.obtenido_shiny)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) || String(p.id).includes(q)
    )
    return list
  }, [filter, search, registry])

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Pokédex</h2>
            <span className={styles.count}>{obtainedCount} / {NON_MEGA_TOTAL}</span>
          </div>
          <div className={styles.filterRow}>
            {(['all', 'obtained', 'shiny'] as Filter[]).map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                onClick={() => { setFilter(f); setSelected(null) }}
              >
                {f === 'all' ? 'Todos' : f === 'obtained' ? 'Obtenidos' : 'Shiny'}
              </button>
            ))}
          </div>
          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Buscar por nombre o número…"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              className={styles.searchInput}
              autoComplete="off"
              spellCheck={false}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Body (grid + optional detail) ── */}
        <div className={styles.body}>
          <div className={styles.grid}>
            {visible.map(p => {
              const entry      = registry[p.id]
              const gotNormal  = entry?.obtenido_normal ?? false
              const gotShiny   = entry?.obtenido_shiny  ?? false
              const hallFame   = entry?.hall_fame_history_mode ?? 0
              const isObtained = gotNormal || gotShiny
              const isClickable = isObtained

              return (
                <div
                  key={p.id}
                  className={`
                    ${styles.cell}
                    ${isObtained ? styles.cellObtained : styles.cellMissing}
                    ${p.is_mega ? styles.cellMega : ''}
                    ${selected?.id === p.id ? styles.cellSelected : ''}
                    ${isClickable ? styles.cellClickable : ''}
                  `}
                  onClick={isClickable ? () => setSelected(p) : undefined}
                >
                  {p.is_mega && <span className={styles.megaTag}>MEGA</span>}
                  <img
                    className={styles.artwork}
                    src={officialArtwork(p.id)}
                    alt={isObtained || p.is_mega ? p.name : '???'}
                    loading="lazy"
                  />
                  <span className={styles.cellId}>{padId(p.id)}</span>
                  <span className={styles.cellName}>
                    {isObtained || p.is_mega ? p.name : '???'}
                  </span>
                </div>
              )
            })}
            {visible.length === 0 && (
              <p className={styles.empty}>
                {search.trim() ? 'Sin resultados.' : 'No hay ningún Pokémon en esta categoría.'}
              </p>
            )}
          </div>

          {selected && (
            <PokedexDetail
              pokemon={selected}
              entry={registry[selected.id]}
              registry={registry}
              onClose={() => setSelected(null)}
              onSelect={setSelected}
            />
          )}
        </div>

      </div>
    </div>,
    document.body,
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

export function PokedexButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} title="Abrir Pokédex">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#cc2222"/>
          <rect x="2" y="11" width="20" height="2" fill="#111"/>
          <circle cx="12" cy="12" r="4" fill="white" stroke="#111" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="2" fill="#111"/>
          <circle cx="7" cy="7" r="1.2" fill="white" opacity="0.6"/>
        </svg>
        Pokédex
      </button>
      {open && <PokedexModal onClose={() => setOpen(false)} />}
    </>
  )
}
