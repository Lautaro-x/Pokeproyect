import { PokemonInstance } from '../entities/PokemonInstance'
import type { PokemonData } from '../../types'
import allPokemon from '../../assets/pokemon.json'

const DB = allPokemon as PokemonData[]

export interface EvolutionEvent {
  fromName: string
  fromId:   number
  toName:   string
  toId:     number
}

export interface EvolveResult {
  events: EvolutionEvent[]
  branch: PokemonData[] | null
}

export type RegisterFn = (id: number, shiny: boolean) => void

export function applyEvolution(
  pokemon: PokemonInstance,
  newData: PokemonData,
  register: RegisterFn,
): EvolutionEvent {
  const fromName   = pokemon.data.name
  const fromId     = pokemon.data.id
  const wasFainted = pokemon.currentHp === 0
  const hpPct      = pokemon.currentHp / pokemon.getMaxHp()
  pokemon.data      = newData
  pokemon.currentHp = wasFainted ? 0 : Math.max(1, Math.floor(pokemon.getMaxHp() * hpPct))
  register(newData.id, pokemon.shiny)
  return { fromName, fromId, toName: newData.name, toId: newData.id }
}

export function evolveIfReady(pokemon: PokemonInstance, register: RegisterFn): EvolveResult {
  const events: EvolutionEvent[] = []
  let evolved = true
  while (evolved) {
    evolved = false
    const candidates = pokemon.data.evolutions
      .filter(e => e.trigger === 'level' && e.level <= pokemon.level)
      .map(e => DB.find(p => p.name === e.to_name))
      .filter((d): d is PokemonData => d !== undefined)

    if (candidates.length === 0) break
    if (candidates.length > 1) return { events, branch: candidates }

    events.push(applyEvolution(pokemon, candidates[0], register))
    evolved = true
  }
  return { events, branch: null }
}
