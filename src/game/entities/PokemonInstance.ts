import type { PokemonData, PokemonType, AttackLevel } from '../../types'

function attackLevelFromLevel(level: number): AttackLevel {
  if (level <= 20) return 1
  if (level <= 30) return Math.random() < 0.5 ? 1 : 2
  if (level <= 50) return 2
  if (level <= 60) return Math.random() < 0.5 ? 2 : 3
  return 3
}

export interface Item {
  id: string
  name: string
  sprite: string
  description?: string
  typeOverride?: PokemonType
  consumable?: boolean
  price?:      number
  weight?:     number
  shopMaxQty?: number
}

export class PokemonInstance {
  data: PokemonData
  level: number
  attackLevel: AttackLevel
  equippedItem: Item | null
  currentHp: number  // persiste entre rondas
  preMegaData: PokemonData | null = null
  shiny: boolean = false

  constructor(data: PokemonData, level: number, attackLevel?: AttackLevel) {
    this.data = data
    this.level = level
    this.attackLevel = attackLevel ?? attackLevelFromLevel(level)
    this.equippedItem = null
    this.currentHp = this.getMaxHp()
  }

  getMaxHp(): number {
    const base = this.data.stats.hp
    return Math.floor(((2 * base + 31) * this.level) / 100) + this.level + 10
  }

  getStat(statName: keyof Omit<PokemonData['stats'], 'hp'>): number {
    const base = this.data.stats[statName]
    const raw  = Math.floor(((2 * base + 31) * this.level) / 100) + 5
    const mult = this.getItemStatMultiplier(statName)
    return mult === 1 ? raw : Math.floor(raw * mult)
  }

  private getItemStatMultiplier(statName: keyof Omit<PokemonData['stats'], 'hp'>): number {
    const id = this.equippedItem?.id
    if (!id) return 1
    if (id === 'assault-vest'  && (statName === 'defense' || statName === 'special_defense')) return 1.5
    if (id === 'eviolite'      && (statName === 'defense' || statName === 'special_defense') && this.data.evolutions.some(e => e.trigger !== 'mega')) return 1.5
    if (id === 'choice-band'   && statName === 'attack')          return 1.5
    if (id === 'choice-specs'  && statName === 'special_attack')  return 1.5
    if (id === 'choice-scarf'  && statName === 'speed')           return 1.5
    return 1
  }

  getAttackStat(): number {
    return this.data.attack_category === 'physical'
      ? this.getStat('attack')
      : this.getStat('special_attack')
  }

  getDefenseStat(): number {
    return this.data.attack_category === 'physical'
      ? this.getStat('defense')
      : this.getStat('special_defense')
  }

  getSpeedStat(): number {
    return this.getStat('speed')
  }

  setLevel(newLevel: number): void {
    const wasFainted = this.currentHp === 0
    const hpPct = this.currentHp / this.getMaxHp()
    this.level = newLevel
    this.currentHp = wasFainted ? 0 : Math.max(1, Math.floor(this.getMaxHp() * hpPct))
  }

  getEffectiveType(): PokemonType {
    if (this.equippedItem?.typeOverride) return this.equippedItem.typeOverride
    if (this.equippedItem?.id === 'metronome' && this.data.types.length > 1) return this.data.types[1]
    return this.data.types[0]
  }

}
