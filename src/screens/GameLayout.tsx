import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './GameLayout.module.css'
import { TeamPanel } from './panels/TeamPanel'
import { BackpackPanel } from './panels/BackpackPanel'
import { SynergyPanel } from './panels/SynergyPanel'
import { CombatArea } from './combat/CombatArea'
import { EvolutionModal } from '../components/EvolutionModal'
import type { RoundResult } from './combat/CombatArea'
import { PokemonInstance } from '../game/entities/PokemonInstance'
import type { Item } from '../game/entities/PokemonInstance'
import type { ConsumableStack } from '../game/data/items'
import type { PokemonData } from '../types'
import allPokemon from '../assets/pokemon.json'
import movesRaw  from '../assets/moves.json'
import { ALL_EQUIPABLES, ALL_CONSUMABLES } from '../game/data/items'

interface MoveEntry { type: string; category: string; name: string; level: number }
const movesData = movesRaw as MoveEntry[]

const DB    = allPokemon as PokemonData[]
const POOL  = DB.filter(p => !p.is_legendary && !p.is_mythical && !p.is_mega)
const LEVEL = 50

const NORMAL_POOL   = POOL.filter(p => p.types.includes('normal'))
const FIRE_POOL     = POOL.filter(p => p.types.includes('fire'))
const WATER_POOL    = POOL.filter(p => p.types.includes('water'))
const ELECTRIC_POOL = POOL.filter(p => p.types.includes('electric'))
const GRASS_POOL    = POOL.filter(p => p.types.includes('grass'))
const ICE_POOL      = POOL.filter(p => p.types.includes('ice'))
const FIGHTING_POOL = POOL.filter(p => p.types.includes('fighting'))
const POISON_POOL   = POOL.filter(p => p.types.includes('poison'))
const GROUND_POOL   = POOL.filter(p => p.types.includes('ground'))
const FLYING_POOL   = POOL.filter(p => p.types.includes('flying'))
const PSYCHIC_POOL  = POOL.filter(p => p.types.includes('psychic'))
const BUG_POOL      = POOL.filter(p => p.types.includes('bug'))
const ROCK_POOL     = POOL.filter(p => p.types.includes('rock'))
const GHOST_POOL    = POOL.filter(p => p.types.includes('ghost'))
const DRAGON_POOL   = POOL.filter(p => p.types.includes('dragon'))
const DARK_POOL     = POOL.filter(p => p.types.includes('dark'))
const STEEL_POOL    = POOL.filter(p => p.types.includes('steel'))
const FAIRY_POOL    = POOL.filter(p => p.types.includes('fairy'))
const LEGENDARY_POOL = DB.filter(p => p.is_legendary)
const MYTHICAL_POOL  = DB.filter(p => p.is_mythical)

const NO_RANDOM_POOL = DB.filter(p => p.name === 'groudon')

function randomTeam(size = 6, level = LEVEL): PokemonInstance[] {
  let pool_util = DB
  return Array.from({ length: size }, () => pool_util[Math.floor(Math.random() * pool_util.length)]).map(p => new PokemonInstance(p, level))
}

export type GamePhase = 'positioning' | 'fighting'

interface EvolutionEntry {
  teamIdx: number
  choices: PokemonData[]
  isMega?: boolean
}

function getMegaChoices(instance: PokemonInstance): PokemonData[] {
  return instance.data.evolutions
    .filter(e => e.trigger === 'mega')
    .map(e => DB.find(p => p.name === e.to_name))
    .filter((d): d is PokemonData => d !== undefined)
}

function buildMegaForm(current: PokemonInstance, chosenData: PokemonData): PokemonInstance {
  const hpPct = current.currentHp / current.getMaxHp()
  const mega = new PokemonInstance(chosenData, current.level, current.attackLevel)
  mega.equippedItem = current.equippedItem
  mega.currentHp = Math.max(1, Math.floor(mega.getMaxHp() * hpPct))
  mega.preMegaData = current.data
  return mega
}

function buildReverted(current: PokemonInstance): PokemonInstance | null {
  if (!current.preMegaData) return null
  const hpPct = current.currentHp / current.getMaxHp()
  const reverted = new PokemonInstance(current.preMegaData, current.level, current.attackLevel)
  reverted.equippedItem = current.equippedItem
  reverted.currentHp = Math.max(1, Math.floor(reverted.getMaxHp() * hpPct))
  return reverted
}

function ResultBanner({ result }: { result: 'win' | 'lose' }) {
  const label = result === 'win' ? 'WIN!' : 'LOSE!'
  return (
    <svg viewBox="0 0 220 60" style={{ width: '85%', maxWidth: 300, overflow: 'visible' }}>
      <text
        x="110" y="46"
        textAnchor="middle"
        fontSize="52"
        fontWeight="900"
        fontFamily="Arial Black, Impact, sans-serif"
        fill="#e63946"
        stroke="#ffd700"
        strokeWidth="3.5"
        paintOrder="stroke"
        letterSpacing="1"
      >{label}</text>
    </svg>
  )
}

export default function GameLayout() {
  const navigate = useNavigate()

  const [playerTeam,     setPlayerTeam]     = useState<PokemonInstance[]>(() => randomTeam())
  const [enemyTeam,      setEnemyTeam]      = useState<PokemonInstance[]>(() => randomTeam())
  const [placements,     setPlacements]     = useState<(number | null)[]>(Array(6).fill(null))
  const [phase,          setPhase]          = useState<GamePhase>('positioning')
  const [faintedIndices, setFaintedIndices] = useState<Set<number>>(new Set())
  const [gameResult,     setGameResult]     = useState<'win' | 'lose' | null>(null)
  const [gameRound,      setGameRound]      = useState(1)
  const [evolutionQueue, setEvolutionQueue] = useState<EvolutionEntry[]>([])
  const [backpack,       setBackpack]       = useState<Item[]>(ALL_EQUIPABLES)
  const [consumables,    setConsumables]    = useState<ConsumableStack[]>(ALL_CONSUMABLES)
  const [oakMessage,     setOakMessage]     = useState<string | null>(null)

  const placedIndices = useMemo(
    () => new Set(placements.filter(p => p !== null) as number[]),
    [placements]
  )

  const handlePlace = (slotIndex: number, teamIndex: number) => {
    setPlacements(prev => {
      const next = [...prev]
      const old = next.indexOf(teamIndex)
      if (old !== -1) next[old] = null
      next[slotIndex] = teamIndex
      return next
    })
  }

  const handleUnplace = (slotIndex: number) =>
    setPlacements(prev => { const n = [...prev]; n[slotIndex] = null; return n })

  const handleLevelUp = (teamIdx: number, newLevel: number) => {
    setPlayerTeam(current => {
      const instance = current[teamIdx]
      const validEvos = instance.data.evolutions.filter(
        e => e.trigger === 'level' && newLevel >= e.level
      )
      if (validEvos.length === 0) return current
      const choices = validEvos
        .map(e => DB.find(p => p.name === e.to_name))
        .filter((d): d is PokemonData => d !== undefined)
      if (choices.length === 0) return current
      setEvolutionQueue(q => [...q, { teamIdx, choices }])
      return current
    })
  }

  const handleEvolutionComplete = (chosenData: PokemonData) => {
    const entry = evolutionQueue[0]
    if (!entry) return

    setPlayerTeam(prev => prev.map((p, i) => {
      if (i !== entry.teamIdx) return p
      if (entry.isMega) return buildMegaForm(p, chosenData)
      const hpPercent = p.currentHp / p.getMaxHp()
      const evolved = new PokemonInstance(chosenData, p.level, p.attackLevel)
      evolved.equippedItem = p.equippedItem
      evolved.currentHp = Math.max(1, Math.floor(evolved.getMaxHp() * hpPercent))
      return evolved
    }))

    setEvolutionQueue(prev => prev.slice(1))
  }

  const handleReorder = (from: number, to: number) => {
    setPlayerTeam(prev => {
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]]
      return next
    })
    setPlacements(prev => prev.map(p => p === from ? to : p === to ? from : p))
    setFaintedIndices(prev => {
      const next = new Set<number>()
      prev.forEach(idx => next.add(idx === from ? to : idx === to ? from : idx))
      return next
    })
  }

  const handleItemDropOnPokemon = (dragJson: string, toTeamIdx: number) => {
    const drag = JSON.parse(dragJson) as { source: 'backpack'; itemId: string } | { source: 'pokemon'; teamIdx: number }

    if (drag.source === 'backpack') {
      const item = backpack.find(i => i.id === drag.itemId)
      if (!item) return
      const displaced = playerTeam[toTeamIdx].equippedItem
      playerTeam[toTeamIdx].equippedItem = item
      setBackpack(backpack.filter(i => i.id !== item.id).concat(displaced ? [displaced] : []))

      if (displaced?.id === 'charizardite-x') {
        // Displaced megastone → revert mega (reverted gets new `item` as equippedItem)
        setPlayerTeam(prev => {
          const reverted = buildReverted(prev[toTeamIdx])
          if (!reverted) return [...prev]
          const next = [...prev]; next[toTeamIdx] = reverted; return next
        })
      } else {
        setPlayerTeam([...playerTeam])
      }

      if (item.id === 'charizardite-x') {
        const megaChoices = getMegaChoices(playerTeam[toTeamIdx])
        if (megaChoices.length >= 1) {
          setEvolutionQueue(q => [...q, { teamIdx: toTeamIdx, choices: megaChoices, isMega: true }])
        }
      }

    } else if (drag.source === 'pokemon') {
      const fromIdx = drag.teamIdx
      if (fromIdx === toTeamIdx) return
      const itemFromFrom = playerTeam[fromIdx].equippedItem
      const itemFromTo   = playerTeam[toTeamIdx].equippedItem
      playerTeam[fromIdx].equippedItem = itemFromTo
      playerTeam[toTeamIdx].equippedItem = itemFromFrom

      const megaLeavesFrom = itemFromFrom?.id === 'charizardite-x'
      const megaLeavesTo   = itemFromTo?.id   === 'charizardite-x'

      if (megaLeavesFrom || megaLeavesTo) {
        setPlayerTeam(prev => {
          const next = [...prev]
          if (megaLeavesFrom) {
            const r = buildReverted(prev[fromIdx]); if (r) next[fromIdx] = r
          }
          if (megaLeavesTo) {
            const r = buildReverted(prev[toTeamIdx]); if (r) next[toTeamIdx] = r
          }
          return next
        })
        if (megaLeavesFrom) {
          const choices = getMegaChoices(playerTeam[toTeamIdx])
          if (choices.length >= 1) setEvolutionQueue(q => [...q, { teamIdx: toTeamIdx, choices, isMega: true }])
        }
        if (megaLeavesTo) {
          const choices = getMegaChoices(playerTeam[fromIdx])
          if (choices.length >= 1) setEvolutionQueue(q => [...q, { teamIdx: fromIdx, choices, isMega: true }])
        }
      } else {
        setPlayerTeam([...playerTeam])
      }
    }
  }

  const handleItemDropOnBackpack = (dragJson: string) => {
    const drag = JSON.parse(dragJson) as { source: string; teamIdx?: number }
    if (drag.source !== 'pokemon' || drag.teamIdx === undefined) return
    const teamIdx = drag.teamIdx
    const item = playerTeam[teamIdx].equippedItem
    if (!item) return
    playerTeam[teamIdx].equippedItem = null
    setBackpack([...backpack, item])
    if (item.id === 'charizardite-x') {
      setPlayerTeam(prev => {
        const reverted = buildReverted(prev[teamIdx])
        if (!reverted) return [...prev]
        const next = [...prev]; next[teamIdx] = reverted; return next
      })
    } else {
      setPlayerTeam([...playerTeam])
    }
  }

  const handleConsumableDropOnPokemon = (dragJson: string, toTeamIdx: number) => {
    const drag = JSON.parse(dragJson) as { source: string; itemId: string }
    if (drag.source !== 'backpack') return

    const stackIdx = consumables.findIndex(s => s.item.id === drag.itemId)
    if (stackIdx === -1) return
    const { item, qty } = consumables[stackIdx]
    if (qty <= 0) return

    const instance = playerTeam[toTeamIdx]

    if (item.id !== 'revive' && instance.currentHp <= 0) {
      setOakMessage('Cada cosa en su debido momento')
      return
    }

    if (item.id === 'potion') {
      const heal = Math.floor(instance.getMaxHp() * 0.30)
      instance.currentHp = Math.min(instance.getMaxHp(), instance.currentHp + heal)
      setPlayerTeam([...playerTeam])

    } else if (item.id === 'revive') {
      if (instance.currentHp > 0) return
      instance.currentHp = Math.floor(instance.getMaxHp() * 0.50)
      setFaintedIndices(prev => { const next = new Set(prev); next.delete(toTeamIdx); return next })
      setPlayerTeam([...playerTeam])

    } else if (item.id === 'moon-stone') {
      const choices = instance.data.evolutions
        .map(e => DB.find(p => p.name === e.to_name))
        .filter((d): d is PokemonData => d !== undefined)
      if (choices.length === 0) {
        setOakMessage('Cada cosa en su debido momento')
        return
      }
      setEvolutionQueue(q => [...q, { teamIdx: toTeamIdx, choices }])
      setPlayerTeam([...playerTeam])

    } else if (item.id === 'rare-candy') {
      instance.setLevel(instance.level + 1)
      const newLevel = instance.level
      const validEvos = instance.data.evolutions.filter(
        e => e.trigger === 'level' && newLevel >= e.level
      )
      const choices = validEvos
        .map(e => DB.find(p => p.name === e.to_name))
        .filter((d): d is PokemonData => d !== undefined)
      if (choices.length > 0) {
        setEvolutionQueue(q => [...q, { teamIdx: toTeamIdx, choices }])
      }
      setPlayerTeam([...playerTeam])

    } else if (item.id === 'tm') {
      if (instance.attackLevel >= 3) {
        setOakMessage('Cada cosa en su debido momento')
        return
      }
      instance.attackLevel = (instance.attackLevel + 1) as typeof instance.attackLevel
      const newMove = movesData.find(m =>
        m.type     === instance.getEffectiveType() &&
        m.category === instance.data.attack_category &&
        m.level    === instance.attackLevel
      )
      setOakMessage(`¡${instance.data.name} ha aprendido ${newMove?.name ?? 'un nuevo movimiento'}!`)
      setPlayerTeam([...playerTeam])
    }

    // Consume one unit
    setConsumables(prev => {
      const next = [...prev]
      const newQty = next[stackIdx].qty - 1
      if (newQty <= 0) {
        next.splice(stackIdx, 1)
      } else {
        next[stackIdx] = { item, qty: newQty }
      }
      return next
    })
  }

  const handleRoundEnd = () => {
    const newFainted = new Set(faintedIndices)
    playerTeam.forEach((p, i) => { if (p.currentHp <= 0) newFainted.add(i) })
    setFaintedIndices(newFainted)

    const allEnemiesDefeated = enemyTeam.every(p => p.currentHp <= 0)
    const allPlayersFainted  = playerTeam.every(p => p.currentHp <= 0)

    if (allEnemiesDefeated) { setGameResult('win');  return }
    if (allPlayersFainted)  { setGameResult('lose'); return }

    setGameRound(prev => prev + 1)
    setEnemyTeam([...enemyTeam].sort((a, b) => b.currentHp - a.currentHp))
    setPlacements(Array(6).fill(null))
    setPhase('positioning')
  }

  const pendingEvolution = evolutionQueue[0] ?? null

  return (
    <div className={styles.screen}>
    <div className={styles.gameGroup}>

      <div className={styles.leftPanel}>
        <TeamPanel
          team={playerTeam}
          placedIndices={placedIndices}
          faintedIndices={faintedIndices}
          locked={phase === 'fighting'}
          onBack={() => navigate('/')}
          onReorder={handleReorder}
          onItemDrop={handleItemDropOnPokemon}
          onConsumableDrop={handleConsumableDropOnPokemon}
        />
      </div>

      <div className={styles.gameBox}>
        <CombatArea
          key={gameRound}
          playerTeam={playerTeam}
          enemyTeam={enemyTeam}
          placements={placements}
          phase={phase}
          gameRound={gameRound}
          onPlace={handlePlace}
          onUnplace={handleUnplace}
          onStart={() => setPhase('fighting')}
          onRoundEnd={handleRoundEnd}
          onLevelUp={handleLevelUp}
        />

        {gameResult && (
          <div className={styles.resultOverlay}>
            <ResultBanner result={gameResult} />
            <button className={styles.resultBtn} onClick={() => navigate('/')}>
              Volver al menú
            </button>
          </div>
        )}
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.rightCard}>
          <BackpackPanel
            equipables={backpack}
            consumables={consumables}
            onItemDrop={handleItemDropOnBackpack}
          />
        </div>
        <div className={styles.rightCard}>
          <SynergyPanel
            playerTeam={playerTeam.filter((_, i) => placements.includes(i))}
            enemyTeam={enemyTeam}
          />
        </div>
      </div>

    </div>

    {oakMessage && (
      <div className={styles.oakOverlay} onClick={() => setOakMessage(null)}>
        <div className={styles.oakModal} onClick={e => e.stopPropagation()}>
          <svg className={styles.oakCard} viewBox="0 0 60 84" width="60" height="84" fill="none">
            <rect x="2" y="2" width="56" height="80" rx="6" fill="#1a1840" stroke="#5550a0" strokeWidth="1.5"/>
            <rect x="7" y="7" width="46" height="70" rx="4" fill="none" stroke="#2e2a60" strokeWidth="1"/>
            {/* inner decoration: simplified Poké Ball */}
            <circle cx="30" cy="42" r="14" fill="none" stroke="#4a4480" strokeWidth="1.2"/>
            <line x1="16" y1="42" x2="44" y2="42" stroke="#4a4480" strokeWidth="1.2"/>
            <circle cx="30" cy="42" r="4.5" fill="#1a1840" stroke="#7a70c0" strokeWidth="1.2"/>
            {/* top-left corner pip */}
            <circle cx="11" cy="13" r="2" fill="#5550a0"/>
            {/* bottom-right corner pip */}
            <circle cx="49" cy="71" r="2" fill="#5550a0"/>
          </svg>
          <div className={styles.oakTitle}>Prof. Oak</div>
          <p className={styles.oakText}>{oakMessage}</p>
          <button className={styles.oakBtn} onClick={() => setOakMessage(null)}>Entendido</button>
        </div>
      </div>
    )}

    {pendingEvolution && (
      <EvolutionModal
        currentData={playerTeam[pendingEvolution.teamIdx].data}
        choices={pendingEvolution.choices}
        onComplete={handleEvolutionComplete}
      />
    )}

    </div>
  )
}
