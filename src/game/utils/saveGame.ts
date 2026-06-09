import { PokemonInstance } from '../entities/PokemonInstance'
import { ALL_ITEMS } from '../data/items'
import type { Item } from '../entities/PokemonInstance'
import type { ConsumableStack } from '../data/items'
import type { PokemonData } from '../../types'
import type { MapData } from '../../screens/history/mapGenerator'
import allPokemon from '../../assets/pokemon.json'

const DB = allPokemon as PokemonData[]

// ── Mode ─────────────────────────────────────────────────────────────────────

export type GameMode = 'historia'
// future: | 'tryhard' | 'permadeath' | 'randomlock'

export const MODE_LABELS: Record<GameMode, string> = {
  historia: 'Modo Historia',
}

const SAVE_KEY = (mode: GameMode) => `pk_save_${mode}`
const BKP_KEY  = (mode: GameMode) => `pk_bkp_${mode}`

// ── Serialized types ──────────────────────────────────────────────────────────

interface SavedPokemon {
  dataId:         number
  level:          number
  attackLevel:    number
  currentHp:      number
  shiny:          boolean
  equippedItemId: string | null
  preMegaDataId:  number | null
}

export interface HistorySave {
  mode:         GameMode
  version:      number
  region:       string
  gen:          number
  mapNumber:    number
  mapData:      MapData
  completedIds: string[]
  currentId:    string | null
  money:        number
  team:         SavedPokemon[]
  backpack:     string[]
  consumables:  { itemId: string; qty: number }[]
}

// ── App types (deserialized) ───────────────────────────────────────────────────

export interface LoadedSave {
  region:       string
  gen:          number
  mapNumber:    number
  mapData:      MapData
  completedIds: Set<string>
  currentId:    string | null
  money:        number
  team:         PokemonInstance[]
  backpack:     Item[]
  consumables:  ConsumableStack[]
}

// ── Serialization helpers ─────────────────────────────────────────────────────

function serializePokemon(p: PokemonInstance): SavedPokemon {
  return {
    dataId:         p.data.id,
    level:          p.level,
    attackLevel:    p.attackLevel,
    currentHp:      p.currentHp,
    shiny:          p.shiny,
    equippedItemId: p.equippedItem?.id ?? null,
    preMegaDataId:  p.preMegaData ? (p.preMegaData as PokemonData).id : null,
  }
}

function deserializePokemon(s: SavedPokemon): PokemonInstance | null {
  const data = DB.find(p => p.id === s.dataId)
  if (!data) return null
  const inst = new PokemonInstance(data, s.level, s.attackLevel as 0 | 1 | 2 | 3)
  inst.currentHp    = s.currentHp
  inst.shiny        = s.shiny
  inst.equippedItem = s.equippedItemId
    ? ALL_ITEMS.find(i => i.id === s.equippedItemId) ?? null
    : null
  inst.preMegaData  = s.preMegaDataId
    ? (DB.find(p => p.id === s.preMegaDataId) as PokemonData ?? null)
    : null
  return inst
}

// ── Public API ────────────────────────────────────────────────────────────────

export function writeSave(
  mode: GameMode,
  data: Omit<LoadedSave, 'completedIds'> & { completedIds: string[] },
): void {
  const key    = SAVE_KEY(mode)
  const bkpKey = BKP_KEY(mode)

  const existing = localStorage.getItem(key)
  if (existing) localStorage.setItem(bkpKey, existing)

  const save: HistorySave = {
    mode,
    version:      1,
    region:       data.region,
    gen:          data.gen,
    mapNumber:    data.mapNumber,
    mapData:      data.mapData,
    completedIds: data.completedIds,
    currentId:    data.currentId,
    money:        data.money,
    team:         data.team.map(serializePokemon),
    backpack:     data.backpack.map(i => i.id),
    consumables:  data.consumables.map(c => ({ itemId: c.item.id, qty: c.qty })),
  }

  localStorage.setItem(key, JSON.stringify(save))
}

export function readSave(mode: GameMode): LoadedSave | null {
  // Try primary, fall back to backup
  const raw = localStorage.getItem(SAVE_KEY(mode)) ?? localStorage.getItem(BKP_KEY(mode))
  if (!raw) return null
  try {
    const save = JSON.parse(raw) as HistorySave
    if (save.mode !== mode) return null
    return {
      region:       save.region,
      gen:          save.gen,
      mapNumber:    save.mapNumber,
      mapData:      save.mapData,
      completedIds: new Set(save.completedIds),
      currentId:    save.currentId,
      money:        save.money,
      team:         save.team
        .map(deserializePokemon)
        .filter((p): p is PokemonInstance => p !== null),
      backpack:     save.backpack
        .map(id => ALL_ITEMS.find(i => i.id === id))
        .filter((i): i is Item => i != null),
      consumables:  save.consumables
        .map(c => {
          const item = ALL_ITEMS.find(i => i.id === c.itemId)
          return item ? { item, qty: c.qty } : null
        })
        .filter((c): c is ConsumableStack => c != null),
    }
  } catch {
    return null
  }
}

export function peekSave(mode: GameMode): { mapNumber: number; region: string } | null {
  const raw = localStorage.getItem(SAVE_KEY(mode))
  if (!raw) return null
  try {
    const save = JSON.parse(raw) as HistorySave
    if (save.mode !== mode) return null
    return { mapNumber: save.mapNumber, region: save.region }
  } catch {
    return null
  }
}

export function hasSave(mode: GameMode): boolean {
  return localStorage.getItem(SAVE_KEY(mode)) !== null
}

export function clearSave(mode: GameMode): void {
  localStorage.removeItem(SAVE_KEY(mode))
  localStorage.removeItem(BKP_KEY(mode))
}
