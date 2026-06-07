import type { CombatPokemon } from '../entities/CombatPokemon'
import type { SlotStatus } from '../../types'

export class CombatSlot {
  readonly index: number
  player: CombatPokemon | null
  enemy: CombatPokemon | null
  status: SlotStatus

  constructor(index: number, player: CombatPokemon | null = null, enemy: CombatPokemon | null = null) {
    this.index = index
    this.player = player
    this.enemy = enemy
    this.status = this.computeStatus()
  }

  private computeStatus(): SlotStatus {
    const hasPlayer = this.player !== null && !this.player.isDefeated
    const hasEnemy  = this.enemy  !== null && !this.enemy.isDefeated
    if (!hasPlayer && !hasEnemy) return 'empty'
    if (!hasPlayer) return 'enemy_won'
    if (!hasEnemy)  return 'player_won'
    return 'active'
  }

  isActive(): boolean {
    return this.status === 'active'
  }

  checkResolution(): void {
    this.status = this.computeStatus()
  }
}
