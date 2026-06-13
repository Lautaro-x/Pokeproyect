import type { Gift } from '../../types'

export interface Actor        { id: string | number; name: string; sprite: string }
export interface DialogLine   { actor_id: string | number; text: string }
export interface ScenePokemon {
  id:           number | 'random'
  item:         string | null
  is_shiny:     boolean
  level:        number
  // random-mode filters (only used when id === 'random')
  generation?:  'actual' | 'not_actual' | 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'teselia' | 'kalos' | 'alola' | 'galar' | 'paldea'
  is_legendary?: boolean
  is_mythical?:  boolean
}

export interface OptionEntry {
  text:       string
  condition?: { pokedollars?: number }
  next:       string | null
}

export interface DialogNode {
  type:  'dialog'
  lines: DialogLine[]
  next:  string | null
}

export interface OptionsNode {
  type:    'options'
  options: OptionEntry[]
}

export interface CombatNode {
  type:     'combat'
  pokemons: ScenePokemon[]
  on_win:   string | null
  on_lose:  string | null
}

export interface GiftNode {
  type:  'gift'
  gifts: Gift[]
  next:  string | null
}

export interface ExchangeOffer {
  label:        string
  give:         string | null   // "team_random_0" | null = no swap (decline)
  receive:      string | null   // "pool_0" | "pool_random" | null
  hide_receive: boolean         // if true, don't reveal which pokemon is received
  next:         string | null
}

export interface ExchangeNode {
  type:   'exchange'
  offers: ExchangeOffer[]
}

export type SceneNode = DialogNode | OptionsNode | CombatNode | GiftNode | ExchangeNode

export interface SceneData {
  scene_id:           string
  scene_name:         string
  category:           string
  actors:             Actor[]
  start:              string | null
  nodes:              Record<string, SceneNode>
  // Exchange support: resolved once at scene start
  team_random_count?: number        // how many random player-team slots to pick
  pokemon_pool?:      ScenePokemon[] // scene's offering pool (pool_0, pool_1, …)
  pool_from_combat?:  string         // node ID — if set, pool is captured from that combat on win
}
