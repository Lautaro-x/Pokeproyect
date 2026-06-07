import { PokemonInstance } from './PokemonInstance'

const ATB_RATE = 9.0

export const BONUS_KEYS = ['attack', 'defense', 'special_attack', 'special_defense', 'speed'] as const
export type BonusKey = typeof BONUS_KEYS[number]
export type StatBonuses = Record<BonusKey, number>

export const BONUS_LABELS: Record<BonusKey, string> = {
  attack:          'ATK',
  defense:         'DEF',
  special_attack:  'SpA',
  special_defense: 'SpD',
  speed:           'SPD',
}

export class CombatPokemon {
  readonly instance: PokemonInstance
  currentHp: number
  atbProgress: number
  isDefeated: boolean
  bonuses: StatBonuses
  firstHitAtbReset: boolean   // resets enemy ATB on first outgoing hit
  firstHitDodge: boolean      // dodges first incoming hit
  firstHitCritical: boolean   // first outgoing hit deals 2x damage

  constructor(instance: PokemonInstance) {
    this.instance = instance
    this.currentHp = instance.currentHp
    this.atbProgress = 0
    this.isDefeated = this.currentHp <= 0
    this.bonuses = { attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 }
    this.firstHitAtbReset  = false
    this.firstHitDodge     = false
    this.firstHitCritical  = false
  }

  addBonus(key: BonusKey, delta: number): void {
    this.bonuses[key] = Math.max(-6, Math.min(6, this.bonuses[key] + delta))
  }

  private boosted(base: number, key: BonusKey): number {
    const b = this.bonuses[key]
    const mult = b >= 0 ? 1 + b * 0.25 : 1 + b * 0.10
    return Math.max(1, Math.floor(base * mult))
  }

  getBoostedAttackStat(): number {
    const key = this.instance.data.attack_category === 'physical' ? 'attack' : 'special_attack'
    return this.boosted(this.instance.getAttackStat(), key)
  }

  getBoostedDefenseStat(): number {
    const key = this.instance.data.attack_category === 'physical' ? 'defense' : 'special_defense'
    return this.boosted(this.instance.getDefenseStat(), key)
  }

  tick(deltaMs: number): boolean {
    if (this.isDefeated) return false
    const speedMult = 1 + this.bonuses.speed * 0.25
    this.atbProgress += ((1.0 + (this.instance.getSpeedStat() * speedMult) / 30.0) * deltaMs * ATB_RATE) / 1000
    if (this.atbProgress >= 100) {
      this.atbProgress -= 100
      return true
    }
    return false
  }

  takeDamage(amount: number): void {
    this.currentHp = Math.max(0, this.currentHp - amount)
    if (this.currentHp === 0) this.isDefeated = true
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.instance.getMaxHp(), this.currentHp + amount)
  }

  getHpPercent(): number {
    return this.currentHp / this.instance.getMaxHp()
  }

  getAtbPercent(): number {
    return Math.min(100, this.atbProgress)
  }
}
