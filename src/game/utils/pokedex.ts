const KEY = 'pk_pokedex'
const BKP = 'pk_bkp_pokedex'

export interface PokedexEntry {
  id: number
  obtenido_normal: boolean
  obtenido_shiny: boolean
  hall_fame_history_mode: number
}

export type PokedexData = Record<number, PokedexEntry>

function readRaw(): PokedexData {
  const raw = localStorage.getItem(KEY) ?? localStorage.getItem(BKP)
  if (!raw) return {}
  try { return JSON.parse(raw) as PokedexData } catch { return {} }
}

function writeRaw(data: PokedexData): void {
  const existing = localStorage.getItem(KEY)
  if (existing) localStorage.setItem(BKP, existing)
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function readPokedex(): PokedexData {
  return readRaw()
}

export function registerCatch(id: number, shiny: boolean): void {
  const data = readRaw()
  const entry = data[id] ?? { id, obtenido_normal: false, obtenido_shiny: false, hall_fame_history_mode: 0 }
  if (shiny) entry.obtenido_shiny = true
  else entry.obtenido_normal = true
  data[id] = entry
  writeRaw(data)
}

export function clearPokedex(): void {
  localStorage.removeItem(KEY)
  localStorage.removeItem(BKP)
}

export function incrementHallFame(ids: number[]): void {
  const data = readRaw()
  for (const id of ids) {
    const entry = data[id] ?? { id, obtenido_normal: false, obtenido_shiny: false, hall_fame_history_mode: 0 }
    entry.hall_fame_history_mode++
    data[id] = entry
  }
  writeRaw(data)
}
