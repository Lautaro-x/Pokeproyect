import { PokemonInstance } from '../../game/entities/PokemonInstance'
import { evoStage, hasNonMegaEvo } from '../../game/utils/evolutionGraph'
import { wildLevel } from './mapGenerator'
import type { PokemonData, RegionPresence } from '../../types'
import allPokemon from '../../assets/pokemon.json'

const DB = allPokemon as PokemonData[]

function pickPool(region: string, mapNumber: number): PokemonData[] {
  const key = region as keyof RegionPresence
  return DB.filter(p => {
    if (p.is_mega || p.is_legendary || p.is_mythical) return false
    if ((p.in_region?.[key] ?? 0) === 0) return false

    const stage = evoStage.get(p.name) ?? 0

    if (mapNumber === 1) {
      return stage === 0 && hasNonMegaEvo(p)
    } else if (mapNumber <= 3) {
      return (stage === 0 && hasNonMegaEvo(p)) || stage === 1
    } else {
      return (stage === 0 && hasNonMegaEvo(p)) || stage >= 1
    }
  })
}

export function generateEnemyTeam(
  type: 'wild' | 'wild_plus_mt' | 'trainer',
  region: string,
  floor: number,
  mapNumber: number,
  trainerTypes?: string[],
): PokemonInstance[] {
  const basePool = pickPool(region, mapNumber)

  let pool = basePool
  if (type === 'trainer' && trainerTypes && trainerTypes.length > 0) {
    const filtered = basePool.filter(p => p.types.some(t => trainerTypes.includes(t)))
    if (filtered.length > 0) pool = filtered
  }

  const isWild   = type === 'wild' || type === 'wild_plus_mt'
  const maxCount = isWild ? 1 : (mapNumber === 1 ? 2 : 4)
  const count    = isWild ? 1 : Math.floor(Math.random() * maxCount) + 1

  return Array.from({ length: count }, () => {
    const data = pool[Math.floor(Math.random() * pool.length)]
    const p = new PokemonInstance(data, wildLevel(floor, mapNumber, region))
    if (isWild && Math.random() < 0.10) p.shiny = true
    return p
  })
}
