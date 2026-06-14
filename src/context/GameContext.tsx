import { createContext, useContext, useState, useRef } from 'react'
import { PokemonInstance } from '../game/entities/PokemonInstance'
import { ALL_ITEMS } from '../game/data/items'
import type { Item } from '../game/entities/PokemonInstance'
import type { ConsumableStack } from '../game/data/items'
import type { Gift, PokemonData } from '../types'
import { registerCatch } from '../game/utils/pokedex'
import { evoParentName } from '../game/utils/evolutionGraph'
import allPokemon from '../assets/pokemon.json'

const DB = allPokemon as PokemonData[]

// ── Evolutionary family ───────────────────────────────────────────────────────
export function getEvolutionFamilyIds(startId: number): number[] {
  const start = DB.find(p => p.id === startId)
  if (!start) return [startId]

  let rootName = start.name
  const safety = new Set<string>()
  while (evoParentName.has(rootName) && !safety.has(rootName)) {
    safety.add(rootName)
    rootName = evoParentName.get(rootName)!
  }

  const ids: number[] = []
  const queue = [rootName]
  const seen  = new Set<string>()
  while (queue.length > 0) {
    const name = queue.shift()!
    if (seen.has(name)) continue
    seen.add(name)
    const p = DB.find(pk => pk.name === name)
    if (!p) continue
    ids.push(p.id)
    for (const evo of p.evolutions) queue.push(evo.to_name)
  }
  return ids
}

function getMegaChoices(instance: PokemonInstance): PokemonData[] {
  return instance.data.evolutions
    .filter(e => e.trigger === 'mega')
    .map(e => DB.find(p => p.name === e.to_name))
    .filter((d): d is PokemonData => d !== undefined)
}

function buildReverted(current: PokemonInstance): PokemonInstance | null {
  if (!current.preMegaData) return null
  const hpPct   = current.currentHp / current.getMaxHp()
  const reverted = new PokemonInstance(current.preMegaData, current.level, current.attackLevel)
  reverted.equippedItem = current.equippedItem
  reverted.shiny        = current.shiny
  reverted.currentHp    = Math.max(1, Math.floor(reverted.getMaxHp() * hpPct))
  return reverted
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvolutionCandidate {
  pokemon:  PokemonInstance
  teamIdx:  number
  isMega?:  boolean
}

interface GameState {
  playerTeam:        PokemonInstance[]
  backpack:          Item[]
  consumables:       ConsumableStack[]
  money:             number
  pendingAddPokemon: PokemonInstance | null
}

interface GameActions {
  // Raw setter for complex screen-level mutations (level-up, etc.)
  setPlayerTeam: React.Dispatch<React.SetStateAction<PokemonInstance[]>>

  // Team management
  addPokemon:          (p: PokemonInstance) => boolean        // false if team full (no UI)
  requestAddPokemon:   (p: PokemonInstance, onAdded?: () => void) => void  // shows modal if full
  confirmReplace:      (idx: number) => void
  cancelAddPokemon:    () => void
  replacePokemon:      (idx: number, p: PokemonInstance) => void
  flushTeam:           () => void
  reorderTeam:         (from: number, to: number) => void

  // Item interactions
  applyItemDrop:       (dragJson: string, toTeamIdx: number) => EvolutionCandidate | null
  applyConsumableDrop: (dragJson: string, toTeamIdx: number) => EvolutionCandidate | null | 'rejected'
  unequipToBackpack:   (dragJson: string) => void
  addEquipable:        (item: Item) => void
  removeEquipable:     (itemId: string) => void
  addConsumable:       (item: Item) => void
  deductConsumable:    (itemId: string) => void

  // Economy
  addMoney:   (amount: number) => void
  spendMoney: (amount: number) => void

  // Events
  healTeam:      () => void
  applyGifts:    (gifts: Gift[], context?: { level?: number; gen?: number }) => void
  registerCatch: (id: number, shiny: boolean) => void
}

type GameContextValue = GameState & GameActions

// ── Context ───────────────────────────────────────────────────────────────────

const GameContext = createContext<GameContextValue | null>(null)

interface GameProviderProps {
  children:             React.ReactNode
  initialTeam?:         PokemonInstance[]
  initialBackpack?:     Item[]
  initialConsumables?:  ConsumableStack[]
  initialMoney?:        number
}

export function GameProvider({
  children,
  initialTeam, initialBackpack, initialConsumables, initialMoney,
}: GameProviderProps) {
  const [playerTeam,        setPlayerTeam]        = useState<PokemonInstance[]>(initialTeam        ?? [])
  const [backpack,          setBackpack]          = useState<Item[]>            (initialBackpack    ?? [])
  const [consumables,       setConsumables]       = useState<ConsumableStack[]> (initialConsumables ?? [])
  const [money,             setMoney]             = useState                    (initialMoney       ?? 0)
  const [pendingAddPokemon, setPendingAddPokemon] = useState<PokemonInstance | null>(null)
  const pendingAddCallbackRef = useRef<(() => void) | undefined>(undefined)

  // ── Generic add-to-team helper (used by requestAddPokemon & applyGifts) ───
  const _requestAdd = (p: PokemonInstance, onAdded?: () => void) => {
    if (playerTeam.length < 6) {
      registerCatch(p.data.id, p.shiny)
      setPlayerTeam(prev => [...prev, p])
      onAdded?.()
    } else {
      pendingAddCallbackRef.current = onAdded
      setPendingAddPokemon(p)
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  const addEquipable = (item: Item) =>
    setBackpack(prev => [...prev, item])

  const addConsumable = (item: Item) =>
    setConsumables(prev => {
      const idx = prev.findIndex(s => s.item.id === item.id)
      if (idx === -1) return [...prev, { item, qty: 1 }]
      return prev.map((s, i) => i === idx ? { ...s, qty: s.qty + 1 } : s)
    })

  const deductConsumable = (itemId: string) =>
    setConsumables(prev => {
      const idx = prev.findIndex(s => s.item.id === itemId)
      if (idx === -1 || prev[idx].qty <= 0) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], qty: next[idx].qty - 1 }
      return next.filter(s => s.qty > 0)
    })

  // ── Context value ─────────────────────────────────────────────────────────

  const value: GameContextValue = {
    playerTeam, backpack, consumables, money, pendingAddPokemon,

    setPlayerTeam,

    addPokemon: (p) => {
      if (playerTeam.length >= 6) return false
      registerCatch(p.data.id, p.shiny)
      setPlayerTeam(prev => [...prev, p])
      return true
    },

    requestAddPokemon: (p, onAdded) => _requestAdd(p, onAdded),

    confirmReplace: (idx) => {
      if (!pendingAddPokemon) return
      const p  = pendingAddPokemon
      const cb = pendingAddCallbackRef.current
      pendingAddCallbackRef.current = undefined
      setPendingAddPokemon(null)
      registerCatch(p.data.id, p.shiny)
      setPlayerTeam(prev => { const n = [...prev]; n[idx] = p; return n })
      cb?.()
    },

    cancelAddPokemon: () => {
      pendingAddCallbackRef.current = undefined
      setPendingAddPokemon(null)
    },

    replacePokemon: (idx, p) =>
      setPlayerTeam(prev => { const n = [...prev]; n[idx] = p; return n }),

    flushTeam: () => setPlayerTeam(prev => [...prev]),

    reorderTeam: (from, to) =>
      setPlayerTeam(prev => {
        const n = [...prev]
        const [m] = n.splice(from, 1)
        n.splice(to, 0, m)
        return n
      }),

    // ── Item / equip drag ─────────────────────────────────────────────────

    applyItemDrop: (dragJson, toTeamIdx) => {
      try {
        const drag = JSON.parse(dragJson) as
          | { source: 'backpack'; itemId: string }
          | { source: 'pokemon'; teamIdx: number }

        if (drag.source === 'backpack') {
          const item = backpack.find(i => i.id === drag.itemId)
          if (!item || !playerTeam[toTeamIdx]) return null
          const pokemon   = playerTeam[toTeamIdx]
          const displaced = pokemon.equippedItem

          if (displaced?.id === 'charizardite-x') {
            // Mega stone displaced → revert to base form, then equip new item
            setPlayerTeam(prev => {
              const next = [...prev]
              const reverted = buildReverted(prev[toTeamIdx]) ?? prev[toTeamIdx]
              reverted.equippedItem = item
              next[toTeamIdx] = reverted
              return next
            })
          } else {
            pokemon.equippedItem = item
            setPlayerTeam([...playerTeam])
          }

          setBackpack(prev => {
            const idx  = prev.findIndex(i => i.id === item.id)
            const next = idx !== -1 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : [...prev]
            if (displaced) next.push(displaced)
            return next
          })

          if (item.id === 'charizardite-x') {
            const choices = getMegaChoices(pokemon)
            if (choices.length > 0) return { pokemon, teamIdx: toTeamIdx, isMega: true }
          }
          return null

        } else if (drag.source === 'pokemon') {
          const fromIdx = drag.teamIdx
          if (fromIdx === toTeamIdx) return null
          const itemFromFrom = playerTeam[fromIdx].equippedItem
          const itemFromTo   = playerTeam[toTeamIdx].equippedItem

          playerTeam[fromIdx].equippedItem   = itemFromTo
          playerTeam[toTeamIdx].equippedItem = itemFromFrom

          const megaLeavesFrom = itemFromFrom?.id === 'charizardite-x'
          const megaLeavesTo   = itemFromTo?.id   === 'charizardite-x'

          if (megaLeavesFrom || megaLeavesTo) {
            setPlayerTeam(prev => {
              const next = [...prev]
              if (megaLeavesFrom) {
                const r = buildReverted(prev[fromIdx])
                if (r) { r.equippedItem = itemFromTo; next[fromIdx] = r }
              }
              if (megaLeavesTo) {
                const r = buildReverted(prev[toTeamIdx])
                if (r) { r.equippedItem = itemFromFrom; next[toTeamIdx] = r }
              }
              return next
            })
            // Return candidate for the slot that GAINED the mega stone
            if (megaLeavesFrom) {
              const choices = getMegaChoices(playerTeam[toTeamIdx])
              if (choices.length > 0) return { pokemon: playerTeam[toTeamIdx], teamIdx: toTeamIdx, isMega: true }
            }
            if (megaLeavesTo) {
              const choices = getMegaChoices(playerTeam[fromIdx])
              if (choices.length > 0) return { pokemon: playerTeam[fromIdx], teamIdx: fromIdx, isMega: true }
            }
          } else {
            setPlayerTeam([...playerTeam])
          }
          return null
        }
        return null
      } catch { return null }
    },

    // ── Consumable use ────────────────────────────────────────────────────
    // Returns the pokemon + teamIdx if an evolution check is needed (rare-candy / moon-stone).
    // Each module decides how to present the evolution (auto-animate vs. modal).

    applyConsumableDrop: (dragJson, toTeamIdx) => {
      try {
        const { itemId } = JSON.parse(dragJson) as { source: string; itemId: string }
        const stack = consumables.find(s => s.item.id === itemId)
        if (!stack || stack.qty <= 0) return null
        const pokemon = playerTeam[toTeamIdx]
        if (!pokemon) return null

        let consumed   = true
        let evoCandidate: EvolutionCandidate | null = null

        if (itemId === 'potion') {
          if (pokemon.currentHp <= 0 || pokemon.currentHp >= pokemon.getMaxHp()) consumed = false
          else pokemon.currentHp = Math.min(
            pokemon.getMaxHp(),
            pokemon.currentHp + Math.floor(pokemon.getMaxHp() * 0.30),
          )
        } else if (itemId === 'revive') {
          if (pokemon.currentHp > 0) consumed = false
          else pokemon.currentHp = Math.floor(pokemon.getMaxHp() * 0.50)
        } else if (itemId === 'rare-candy') {
          pokemon.setLevel(pokemon.level + 1)
          evoCandidate = { pokemon, teamIdx: toTeamIdx }
        } else if (itemId === 'moon-stone') {
          const hasTarget = pokemon.data.evolutions.some(
            e => e.trigger !== 'mega' && DB.find(p => p.name === e.to_name),
          )
          if (!hasTarget) consumed = false
          else evoCandidate = { pokemon, teamIdx: toTeamIdx }
        } else if (itemId === 'tm') {
          if (pokemon.attackLevel >= 3) consumed = false
          else pokemon.attackLevel = (pokemon.attackLevel + 1) as typeof pokemon.attackLevel
        }

        if (consumed) {
          setPlayerTeam([...playerTeam])
          deductConsumable(itemId)
          return evoCandidate
        }
        return 'rejected'
      } catch {
        return null
      }
    },

    unequipToBackpack: (dragJson) => {
      try {
        const drag = JSON.parse(dragJson) as { source: 'pokemon'; teamIdx: number }
        if (drag.source !== 'pokemon') return
        const pokemon = playerTeam[drag.teamIdx]
        if (!pokemon?.equippedItem) return
        const item = pokemon.equippedItem
        if (item.id === 'charizardite-x') {
          setPlayerTeam(prev => {
            const next = [...prev]
            const reverted = buildReverted(prev[drag.teamIdx])
            if (reverted) { reverted.equippedItem = null; next[drag.teamIdx] = reverted }
            else prev[drag.teamIdx].equippedItem = null
            return next
          })
        } else {
          pokemon.equippedItem = null
          setPlayerTeam([...playerTeam])
        }
        setBackpack(prev => [...prev, item])
      } catch { /* ignore */ }
    },

    addEquipable,
    removeEquipable: (itemId) =>
      setBackpack(prev => {
        const idx = prev.findIndex(i => i.id === itemId)
        return idx !== -1 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : prev
      }),
    addConsumable,
    deductConsumable,

    addMoney:   (amount) => setMoney(prev => prev + amount),
    spendMoney: (amount) => setMoney(prev => prev - amount),

    healTeam: () => {
      playerTeam.forEach(p => { p.currentHp = p.getMaxHp() })
      setPlayerTeam([...playerTeam])
    },

    applyGifts: (gifts, context) => {
      const newEquipables:  Item[] = []
      const newConsumables: Item[] = []

      const effectHandlers: Record<string, () => void> = {
        random_pokemon_become_shiny: () => {
          const candidates = playerTeam.map((p, i) => ({ p, i })).filter(({ p }) => !p.shiny)
          if (candidates.length === 0) return
          const { p } = candidates[Math.floor(Math.random() * candidates.length)]
          p.shiny = true
          registerCatch(p.data.id, true)
          setPlayerTeam([...playerTeam])
        },
      }

      for (const gift of gifts) {
        if (gift.type === 'effect') {
          effectHandlers[gift.effect]?.()
        } else if (gift.type === 'pokedollars') {
          setMoney(prev => prev + gift.quantity)
        } else if (gift.type === 'item') {
          const item = ALL_ITEMS.find(i => i.id === gift.item_id)
          if (!item) continue
          for (let n = 0; n < (gift.quantity ?? 1); n++) {
            if (item.consumable) newConsumables.push(item)
            else                 newEquipables.push(item)
          }
        } else if (gift.type === 'pokemon') {
          const level = context?.level ?? 50
          const gen   = context?.gen

          let pool = DB.filter(p => !p.is_mega)

          const REGION_GEN: Record<string, number> = {
            kanto: 1, johto: 2, hoenn: 3, sinnoh: 4,
            teselia: 5, kalos: 6, alola: 7, galar: 8, paldea: 9,
          }
          if (gift.generation === 'actual' && gen !== undefined)
            pool = pool.filter(p => p.generation === gen)
          else if (gift.generation === 'not_actual' && gen !== undefined)
            pool = pool.filter(p => p.generation !== gen)
          else if (gift.generation && REGION_GEN[gift.generation] !== undefined)
            pool = pool.filter(p => p.generation === REGION_GEN[gift.generation!])

          if (gift.is_legendary || gift.is_mythical) {
            pool = pool.filter(p =>
              (gift.is_legendary && p.is_legendary) ||
              (gift.is_mythical  && p.is_mythical)
            )
          } else {
            pool = pool.filter(p => !p.is_legendary && !p.is_mythical)
          }

          let pokemon: PokemonInstance | null = null
          if (gift.id !== 'random') {
            const data = DB.find(p => p.id === gift.id)
            if (data) pokemon = new PokemonInstance(data as PokemonData, level)
          } else if (pool.length > 0) {
            const data = pool[Math.floor(Math.random() * pool.length)]
            pokemon = new PokemonInstance(data as PokemonData, level)
          }

          if (pokemon) {
            if (gift.is_shiny) pokemon.shiny = true
            _requestAdd(pokemon)
          }
        }
      }

      if (newEquipables.length) {
        setBackpack(prev => [...prev, ...newEquipables])
      }

      if (newConsumables.length) {
        setConsumables(prev => {
          const result = [...prev]
          for (const item of newConsumables) {
            const idx = result.findIndex(s => s.item.id === item.id)
            if (idx === -1) result.push({ item, qty: 1 })
            else result[idx] = { ...result[idx], qty: result[idx].qty + 1 }
          }
          return result
        })
      }

    },

    registerCatch: (id, shiny) => registerCatch(id, shiny),
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within a <GameProvider>')
  return ctx
}
