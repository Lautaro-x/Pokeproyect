import type { CombatPokemon } from '../entities/CombatPokemon'
import type { AttackLevel } from '../../types'
import { TypeChart } from './TypeChart'

const POWER: Record<AttackLevel, number> = { 1: 40, 2: 70, 3: 100 }

export class DamageCalculator {
  static calculate(
    attacker: CombatPokemon,
    defender: CombatPokemon,
  ): { damage: number; effectiveness: number } {
    const level  = attacker.instance.level
    const power  = POWER[attacker.instance.attackLevel]
    const atk    = attacker.getBoostedAttackStat()
    const def    = defender.getBoostedDefenseStat()
    const effectiveness = TypeChart.getEffectiveness(
      attacker.instance.getEffectiveType(),
      defender.instance.data.types,
    )

    const random = (85 + Math.floor(Math.random() * 16)) / 100

    const base   = Math.floor(((2 * level / 5 + 2) * power * (atk / def)) / 50 + 2)
    const damage = Math.max(1, Math.floor(base * effectiveness * random))

    return { damage, effectiveness }
  }
}
