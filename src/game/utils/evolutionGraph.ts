import type { PokemonData } from '../../types'
import allPokemon from '../../assets/pokemon.json'

const DB = allPokemon as PokemonData[]

// child name → first parent name (any trigger) — used by getEvolutionFamilyIds
export const evoParentName = new Map<string, string>()

// child name → all non-mega parent names — used for evo stage depth
const _parents = new Map<string, string[]>()

for (const p of DB) {
  for (const evo of p.evolutions) {
    if (!evoParentName.has(evo.to_name)) evoParentName.set(evo.to_name, p.name)
    if (evo.trigger !== 'mega') {
      const list = _parents.get(evo.to_name) ?? []
      list.push(p.name)
      _parents.set(evo.to_name, list)
    }
  }
}

function computeStage(name: string, visited = new Set<string>()): number {
  if (visited.has(name)) return 0
  const parents = _parents.get(name)
  if (!parents || parents.length === 0) return 0
  visited.add(name)
  return computeStage(parents[0], visited) + 1
}

// name → evolutionary stage depth (0 = base form), non-mega only
export const evoStage = new Map<string, number>()
DB.forEach(p => { evoStage.set(p.name, computeStage(p.name)) })

export function hasNonMegaEvo(p: PokemonData): boolean {
  return p.evolutions.some(e => e.trigger !== 'mega')
}
