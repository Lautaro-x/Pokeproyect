const KEY = 'pk_unlocked_modes'

export const REGIONS = [
  { id: 'kanto',   name: 'Kanto',   genLabel: 'Gen I',    gen: 1 },
  { id: 'johto',   name: 'Johto',   genLabel: 'Gen II',   gen: 2 },
  { id: 'hoenn',   name: 'Hoenn',   genLabel: 'Gen III',  gen: 3 },
  { id: 'sinnoh',  name: 'Sinnoh',  genLabel: 'Gen IV',   gen: 4 },
  { id: 'teselia', name: 'Teselia', genLabel: 'Gen V',    gen: 5 },
  { id: 'kalos',   name: 'Kalos',   genLabel: 'Gen VI',   gen: 6 },
  { id: 'galar',   name: 'Galar',   genLabel: 'Gen VIII', gen: 8 },
  { id: 'paldea',  name: 'Paldea',  genLabel: 'Gen IX',   gen: 9 },
] as const

export type RegionId = typeof REGIONS[number]['id']

interface StoredModes {
  historia: string[]
}

function readRaw(): StoredModes {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredModes
      if (!Array.isArray(parsed.historia)) parsed.historia = ['kanto']
      if (!parsed.historia.includes('kanto')) parsed.historia.unshift('kanto')
      return parsed
    }
  } catch { /* ignore */ }
  return { historia: ['kanto'] }
}

function writeRaw(data: StoredModes): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function isHistoriaUnlocked(regionId: string): boolean {
  return readRaw().historia.includes(regionId)
}

// Unlocks the next region after completedRegion.
// Returns labels of newly unlocked modes (for display in congratulations screen).
export function unlockNextHistoriaRegion(completedRegion: string): string[] {
  const data = readRaw()
  const idx  = REGIONS.findIndex(r => r.id === completedRegion)
  if (idx === -1 || idx >= REGIONS.length - 1) return []
  const next = REGIONS[idx + 1]
  if (data.historia.includes(next.id)) return []
  data.historia.push(next.id)
  writeRaw(data)
  return [`Modo Historia — ${next.name}`]
}
