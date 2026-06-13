import trainersData from '../../assets/trainers.json'
import type { SceneData } from '../../game/utils/sceneTypes'

export type NodeType = 'start' | 'wild' | 'wild_plus_mt' | 'trainer' | 'boss' | 'final-boss' | 'pokemon-center' | 'shop' | 'random' | 'story'

interface TrainerDef { id: string; sprite: string; types: string[] }

export interface MapNode {
  id:             string
  floor:          number
  col:            number
  totalCols:      number
  type:           NodeType
  nextIds:        string[]
  trainerSprite?: string
  trainerTypes?:  string[]
  storySceneId?:  string
}

// Types used for trainer battles on map 9, per region.
// Empty array = any type (no filter).
const BAD_TEAM_TYPES: Record<string, string[]> = {
  kanto: ['normal', 'poison'],
}

export interface MapData {
  nodes:       Record<string, MapNode>
  floors:      string[][]
  totalFloors: number
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickNodeType(f: number, totalFloors: number, mapNumber: number): NodeType {
  if (f === 0) return mapNumber === 1 ? 'start' : 'pokemon-center'
  if (f === totalFloors - 1) return 'boss'

  // Pokemon Center: pisos 3-8 → 5%, piso 9 → 50%
  if (f >= 3 && f <= 8 && Math.random() < 0.05) return 'pokemon-center'
  if (f === 9 && Math.random() < 0.50) return 'pokemon-center'

  // Shop: pisos 3-9 → 5%
  if (f >= 3 && f <= 9 && Math.random() < 0.05) return 'shop'

  // Random event: mapa 1 → pisos 3-9; mapas 2+ → pisos 1-9; 10%
  const eventEligible = mapNumber === 1 ? f >= 3 : f >= 1
  if (eventEligible && Math.random() < 0.10) return 'random'

  // Trainer: mapa 1 → pisos 3-9; mapas 2+ → pisos 1-9; 30%
  const trainerEligible = mapNumber === 1 ? f >= 3 : f >= 1
  if (trainerEligible && Math.random() < 0.30) return 'trainer'

  // Wild: resto (20% wild_plus_mt, 80% wild)
  return Math.random() < 0.20 ? 'wild_plus_mt' : 'wild'
}

export function generateMap(mapNumber: number, region = 'kanto'): MapData {
  const intermediate = 9
  const totalFloors  = intermediate + 2

  const nodes: Record<string, MapNode> = {}
  const floors: string[][] = []

  for (let f = 0; f < totalFloors; f++) {
    const isStart = f === 0
    const isBoss  = f === totalFloors - 1
    const count   = isStart || isBoss ? 1 : rng(2, 4)

    const floorIds: string[] = []
    for (let c = 0; c < count; c++) {
      const id   = `n${f}_${c}`
      const type = pickNodeType(f, totalFloors, mapNumber)

      const node: MapNode = { id, floor: f, col: c, totalCols: count, type, nextIds: [] }

      if (type === 'trainer') {
        const def = (trainersData as TrainerDef[])[
          Math.floor(Math.random() * trainersData.length)
        ]
        node.trainerSprite = def.sprite
        node.trainerTypes  = def.types
      }

      nodes[id] = node
      floorIds.push(id)
    }
    floors.push(floorIds)
  }

  // ── Garantizar al menos un pokemon-center en piso 9 (no en mapa 9) ───────
  if (mapNumber !== 9) {
    const floor9 = floors[9]
    if (floor9 && !floor9.some(id => nodes[id].type === 'pokemon-center')) {
      const id = floor9[Math.floor(Math.random() * floor9.length)]
      nodes[id].type = 'pokemon-center'
      nodes[id].trainerSprite = undefined
      nodes[id].trainerTypes  = undefined
    }
  }

  // ── Mapa 10: boss → final-boss (Alto Mando + Campeón) ────────────────────
  if (mapNumber === 10) {
    const bossId = floors[totalFloors - 1][0]
    nodes[bossId].type          = 'final-boss'
    nodes[bossId].trainerSprite = 'alto_mando.png'
    nodes[bossId].trainerTypes  = undefined
  }

  // ── Mapa 9: override completo de todos los nodos ──────────────────────────
  if (mapNumber === 9) {
    const badSprite = `bad_${region.charAt(0).toUpperCase() + region.slice(1)}_mini.png`
    const badTypes  = BAD_TEAM_TYPES[region] ?? []
    const storyFloors = new Set([1, 5, totalFloors - 1])

    for (const node of Object.values(nodes)) {
      if (node.floor === 0) continue  // pokemon-center, sin cambios

      if (storyFloors.has(node.floor)) {
        const num = node.floor === 1 ? 1 : node.floor === 5 ? 2 : 3
        node.type         = 'story'
        node.storySceneId = `${region}_bad_team_${num}`
        node.trainerSprite = badSprite
        node.trainerTypes  = undefined
      } else {
        node.type          = 'trainer'
        node.trainerSprite = badSprite
        node.trainerTypes  = badTypes
      }
    }
  }

  // ── Connect adjacent floors (non-crossing by design) ─────────────────────
  for (let f = 0; f < totalFloors - 1; f++) {
    const srcIds = floors[f]
    const dstIds = floors[f + 1]
    const m = srcIds.length
    const n = dstIds.length

    for (let i = 0; i < m; i++) {
      const lo = Math.floor(i * n / m)
      const hi = Math.max(lo, Math.min(n - 1, Math.floor((i + 1) * n / m)))

      const candidates: string[] = []
      for (let j = lo; j <= hi; j++) candidates.push(dstIds[j])
      candidates.sort(() => Math.random() - 0.5)

      const cnt = Math.min(candidates.length, rng(1, 2))
      for (let k = 0; k < cnt; k++) {
        if (!nodes[srcIds[i]].nextIds.includes(candidates[k])) {
          nodes[srcIds[i]].nextIds.push(candidates[k])
        }
      }
    }

    for (let j = 0; j < n; j++) {
      const hasIncoming = srcIds.some(sid => nodes[sid].nextIds.includes(dstIds[j]))
      if (!hasIncoming) {
        for (let i = 0; i < m; i++) {
          const lo = Math.floor(i * n / m)
          const hi = Math.max(lo, Math.min(n - 1, Math.floor((i + 1) * n / m)))
          if (lo <= j && j <= hi) {
            if (!nodes[srcIds[i]].nextIds.includes(dstIds[j])) {
              nodes[srcIds[i]].nextIds.push(dstIds[j])
            }
            break
          }
        }
      }
    }
  }

  return { nodes, floors, totalFloors }
}

/**
 * Level for a wild/trainer Pokémon.
 * Kanto formula: round(10 * (mapNumber - 1) + floor * 1.1) ± 1
 */
export function wildLevel(floor: number, mapNumber: number): number {
  const base = Math.round(10 * (mapNumber - 1) + floor * 1.1)
  const variance = Math.floor(Math.random() * 3) - 1
  return Math.max(1, base + variance)
}

// Finds the gym scene for the current map number, falling back to the
// highest available gym if the exact number doesn't exist.
export function findGymScene(scenes: SceneData[], region: string, mapNumber: number): SceneData | null {
  for (let n = mapNumber; n >= 1; n--) {
    const scene = scenes.find(s => s.scene_id === `${region}_gym_${n}`)
    if (scene) return scene
  }
  return scenes.find(s => s.scene_id.startsWith(`${region}_gym_`)) ?? null
}

// Builds the ordered list of scenes for the final-boss node (Alto Mando + Campeón).
export function buildFinalBossScenes(region: string, allScenes: SceneData[]): SceneData[] {
  const result: SceneData[] = []
  let n = 1
  while (true) {
    const scene = allScenes.find(s => s.scene_id === `${region}_altomando_${n}`)
    if (!scene) break
    result.push(scene)
    n++
  }
  const campeon = allScenes.find(s => s.scene_id === `${region}_campeon`)
  if (campeon) result.push(campeon)
  return result
}
