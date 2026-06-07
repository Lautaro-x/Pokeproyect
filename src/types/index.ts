export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy'

export type AttackCategory = 'physical' | 'special'

export type AttackLevel = 1 | 2 | 3

export interface PokemonStats {
  hp: number
  attack: number
  defense: number
  special_attack: number
  special_defense: number
  speed: number
}

export interface EvolutionEntry {
  to_name: string
  level: number
  trigger: string
}

export interface PokemonSprites {
  front: string | null
  back: string | null
  front_shiny: string | null
  back_shiny: string | null
}

export interface WebmMod {
  zoom?: number
  zoom_position?: [number, number]
}

export interface PokemonData {
  id: number
  name: string
  generation: number
  types: PokemonType[]
  is_legendary: boolean
  is_mythical: boolean
  is_mega: boolean
  attack_category: AttackCategory
  stats: PokemonStats
  evolutions: EvolutionEntry[]
  sprites: PokemonSprites
  webm_mod?: WebmMod
}

export type SlotStatus = 'empty' | 'active' | 'player_won' | 'enemy_won'

export type CombatState = 'positioning' | 'fighting' | 'round_end' | 'game_over'

export interface AttackEvent {
  attackerName: string
  defenderName: string
  damage: number
  typeEffectiveness: number
  slotIndex: number
  side: 'player' | 'enemy'
  isCritical?: boolean
}

export interface RoundEndEvent {
  playerWins: number
  enemyWins: number
}
