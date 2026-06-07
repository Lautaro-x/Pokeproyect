import { create } from 'zustand'
import type { PokemonInstance } from '../game/entities/PokemonInstance'

interface UserProfile {
  id: string
  username: string
  points: number
  victories: number
  defeats: number
  pokedexSeen: number[]
}

interface GameState {
  user: UserProfile | null
  playerTeam: PokemonInstance[]
  setUser: (user: UserProfile | null) => void
  setPlayerTeam: (team: PokemonInstance[]) => void
}

export const useGameStore = create<GameState>((set) => ({
  user: null,
  playerTeam: [],
  setUser: (user) => set({ user }),
  setPlayerTeam: (team) => set({ playerTeam: team }),
}))
