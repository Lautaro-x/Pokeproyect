import type { PokemonInstance } from '../entities/PokemonInstance'
import type { PokemonType } from '../../types'
import type { BonusKey } from '../entities/CombatPokemon'

interface StoredProc {
  chance: number
  atbRefill: number
}

export interface AttackProc extends StoredProc {
  synergyName: string
}

export interface RoundStartBonus {
  key: BonusKey
  delta: number
  target?: 'self' | 'enemy'
}

export interface OnAttackBonus {
  key: BonusKey
  delta: number
  target?: 'self' | 'enemy'
}

export interface AttackAtbReset {
  chance: number
  target: 'self' | 'enemy'
  synergyName: string
}

export interface AttackDebuff {
  chance: number
  target: 'self' | 'enemy'
  bonuses: { key: BonusKey; delta: number }[]
  synergyName: string
}

export interface SynergyEffect {
  damageMultiplier: number
  description: string
  onAttackProc?: StoredProc
  roundStartBonus?: RoundStartBonus[]
  roundStartBonusPerFallen?: { key: BonusKey; delta: number }[]
  onAttackBonus?: OnAttackBonus[]
  onAttackHeal?: number
  onAttackAtbReset?: { chance: number; target?: 'self' | 'enemy' }
  onAttackDebuff?: { chance: number; target?: 'self' | 'enemy'; bonuses: { key: BonusKey; delta: number }[] }
  onAttackSplash?: number
  onRoundEndLevelUp?: number
  onDefendReflect?: number
  onDefendDamageReduction?: number
  onDefendCounterAttack?: number
  roundStartBonusPerRound?: RoundStartBonus[]
  roundStartAtbPercent?: number
  firstHitResetEnemyAtb?: boolean
  firstHitDodge?: boolean
  firstHitCritical?: boolean
  onRoundEndFairyChance?: number
}

export interface Synergy {
  id: string
  name: string
  type: PokemonType
  getCount: (team: PokemonInstance[]) => number
  getLevel: (team: PokemonInstance[]) => 0 | 1 | 2 | 3
  effects: [SynergyEffect, SynergyEffect, SynergyEffect]  // índice 0 = lvl1, 1 = lvl2, 2 = lvl3
}

function calcLevel(count: number): 0 | 1 | 2 | 3 {
  if (count >= 6) return 3
  if (count >= 4) return 2
  if (count >= 2) return 1
  return 0
}

// Weight each alive Pokémon's contribution to a type:
//   single-type normal → 1.5 | single-type shiny → 3
//   dual-type normal   → 1   | dual-type shiny: primary → 2, secondary → 1
function typeScore(p: PokemonInstance, type: PokemonType): number {
  if (p.currentHp <= 0 || !p.data.types.includes(type)) return 0
  const single    = p.data.types.length === 1
  const isPrimary = p.data.types[0] === type
  if (single)      return p.shiny ? 3   : 1.5
  return p.shiny ? (isPrimary    ? 2   : 1) : 1
}

function makeSynergy(
  type: PokemonType,
  name: string,
  effects: [SynergyEffect, SynergyEffect, SynergyEffect],
): Synergy {
  const getCount = (team: PokemonInstance[]) =>
    Math.ceil(team.reduce((sum, p) => sum + typeScore(p, type), 0))
  return {
    id: type,
    name,
    type,
    getCount,
    getLevel: team => calcLevel(getCount(team)),
    effects,
  }
}


export const SYNERGIES: Synergy[] = [
  makeSynergy('fire', 'Llamarada', [
    { damageMultiplier: 1, description: '2 Fuego: ATK y SpA +2 al inicio de cada ronda.', roundStartBonus: [{ key: 'attack', delta: 2 }, { key: 'special_attack', delta: 2 }] },
    { damageMultiplier: 1, description: '4 Fuego: ATK y SpA +4 al inicio de cada ronda.', roundStartBonus: [{ key: 'attack', delta: 4 }, { key: 'special_attack', delta: 4 }] },
    { damageMultiplier: 1, description: '6 Fuego: ATK y SpA +6 al inicio de cada ronda.', roundStartBonus: [{ key: 'attack', delta: 6 }, { key: 'special_attack', delta: 6 }] },
  ]),
  makeSynergy('water', 'Torrente', [
    { damageMultiplier: 1, description: '2 Agua: ATK y SpA enemigo -2 al inicio de cada ronda.', roundStartBonus: [{ key: 'attack', delta: -2, target: 'enemy' }, { key: 'special_attack', delta: -2, target: 'enemy' }] },
    { damageMultiplier: 1, description: '4 Agua: ATK y SpA enemigo -4 al inicio de cada ronda.', roundStartBonus: [{ key: 'attack', delta: -4, target: 'enemy' }, { key: 'special_attack', delta: -4, target: 'enemy' }] },
    { damageMultiplier: 1, description: '6 Agua: ATK y SpA enemigo -6 al inicio de cada ronda.', roundStartBonus: [{ key: 'attack', delta: -6, target: 'enemy' }, { key: 'special_attack', delta: -6, target: 'enemy' }] },
  ]),
  makeSynergy('electric', 'Sobrecarga', [
    { damageMultiplier: 1, description: '2 Eléctrico: SPD +1 al inicio. +1 SPD por ataque.', roundStartBonus: [{ key: 'speed', delta: 1 }], onAttackBonus: [{ key: 'speed', delta: 1 }] },
    { damageMultiplier: 1, description: '4 Eléctrico: SPD +2 al inicio. +1 SPD por ataque.', roundStartBonus: [{ key: 'speed', delta: 2 }], onAttackBonus: [{ key: 'speed', delta: 1 }] },
    { damageMultiplier: 1, description: '6 Eléctrico: SPD +2 al inicio. +2 SPD por ataque.', roundStartBonus: [{ key: 'speed', delta: 2 }], onAttackBonus: [{ key: 'speed', delta: 2 }] },
  ]),
  makeSynergy('grass', 'Fotosíntesis', [
    { damageMultiplier: 1, description: '2 Planta: Se cura el 10% del daño causado al atacar.', onAttackHeal: 0.10 },
    { damageMultiplier: 1, description: '4 Planta: Se cura el 20% del daño causado al atacar.', onAttackHeal: 0.20 },
    { damageMultiplier: 1, description: '6 Planta: Se cura el 30% del daño causado al atacar.', onAttackHeal: 0.30 },
  ]),
  makeSynergy('ice', 'Ventisca', [
    { damageMultiplier: 1, description: '2 Hielo: 20% de prob. de reiniciar el ATB rival al atacar.', onAttackAtbReset: { chance: 0.20 } },
    { damageMultiplier: 1, description: '4 Hielo: 40% de prob. de reiniciar el ATB rival al atacar.', onAttackAtbReset: { chance: 0.40 } },
    { damageMultiplier: 1, description: '6 Hielo: 60% de prob. de reiniciar el ATB rival al atacar.', onAttackAtbReset: { chance: 0.60 } },
  ]),
  makeSynergy('fighting', 'Contraataque', [
    { damageMultiplier: 1, description: '2 Lucha: 17% de prob. de contraatacar al recibir daño (ATB -20%).', onDefendCounterAttack: 0.17 },
    { damageMultiplier: 1, description: '4 Lucha: 34% de prob. de contraatacar al recibir daño (ATB -20%).', onDefendCounterAttack: 0.34 },
    { damageMultiplier: 1, description: '6 Lucha: 50% de prob. de contraatacar al recibir daño (ATB -20%).', onDefendCounterAttack: 0.50 },
  ]),
  makeSynergy('poison', 'Toxina', [
    { damageMultiplier: 1, description: '2 Veneno: 33% de prob. de bajar DEF y SpD del rival al atacar.', onAttackDebuff: { chance: 0.33, target: 'enemy', bonuses: [{ key: 'defense', delta: -1 }, { key: 'special_defense', delta: -1 }] } },
    { damageMultiplier: 1, description: '4 Veneno: 66% de prob. de bajar DEF y SpD del rival al atacar.', onAttackDebuff: { chance: 0.66, target: 'enemy', bonuses: [{ key: 'defense', delta: -1 }, { key: 'special_defense', delta: -1 }] } },
    { damageMultiplier: 1, description: '6 Veneno: Baja DEF y SpD del rival al atacar.',                  onAttackDebuff: { chance: 1.00, target: 'enemy', bonuses: [{ key: 'defense', delta: -1 }, { key: 'special_defense', delta: -1 }] } },
  ]),
  makeSynergy('ground', 'Terremoto', [
    { damageMultiplier: 1, description: '2 Tierra: DEF y SpD +2 al inicio de ronda.', roundStartBonus: [{ key: 'defense', delta: 2 }, { key: 'special_defense', delta: 2 }] },
    { damageMultiplier: 1, description: '4 Tierra: DEF y SpD +4 al inicio de ronda.', roundStartBonus: [{ key: 'defense', delta: 4 }, { key: 'special_defense', delta: 4 }] },
    { damageMultiplier: 1, description: '6 Tierra: DEF y SpD +6 al inicio de ronda.', roundStartBonus: [{ key: 'defense', delta: 6 }, { key: 'special_defense', delta: 6 }] },
  ]),
  makeSynergy('flying', 'Ráfaga', [
    { damageMultiplier: 1, description: '2 Volador: DEF y SpD enemigo -1, SPD propio +1 al inicio de ronda.', roundStartBonus: [{ key: 'defense', delta: -1, target: 'enemy' }, { key: 'special_defense', delta: -1, target: 'enemy' }, { key: 'speed', delta: 1 }] },
    { damageMultiplier: 1, description: '4 Volador: DEF y SpD enemigo -2, SPD propio +2 al inicio de ronda.', roundStartBonus: [{ key: 'defense', delta: -2, target: 'enemy' }, { key: 'special_defense', delta: -2, target: 'enemy' }, { key: 'speed', delta: 2 }] },
    { damageMultiplier: 1, description: '6 Volador: DEF y SpD enemigo -3, SPD propio +3 al inicio de ronda.', roundStartBonus: [{ key: 'defense', delta: -3, target: 'enemy' }, { key: 'special_defense', delta: -3, target: 'enemy' }, { key: 'speed', delta: 3 }] },
  ]),
  makeSynergy('psychic', 'Telequinesis', [
    { damageMultiplier: 1, description: '2 Psíquico: 7.5% del daño al resto de rivales al atacar.',  onAttackSplash: 0.075 },
    { damageMultiplier: 1, description: '4 Psíquico: 10% del daño al resto de rivales al atacar.',   onAttackSplash: 0.10  },
    { damageMultiplier: 1, description: '6 Psíquico: 12.5% del daño al resto de rivales al atacar.', onAttackSplash: 0.125 },
  ]),
  makeSynergy('bug', 'Enjambre', [
    { damageMultiplier: 1, description: '2 Bicho: 15% de prob. de subir 1 nivel al finalizar la ronda.', onRoundEndLevelUp: 0.15 },
    { damageMultiplier: 1, description: '4 Bicho: 25% de prob. de subir 1 nivel al finalizar la ronda.', onRoundEndLevelUp: 0.25 },
    { damageMultiplier: 1, description: '6 Bicho: 35% de prob. de subir 1 nivel al finalizar la ronda.', onRoundEndLevelUp: 0.35 },
  ]),
  makeSynergy('rock', 'Roca Viva', [
    { damageMultiplier: 1, description: '2 Roca: Refleja el 10% del daño recibido al atacante.', onDefendReflect: 0.10 },
    { damageMultiplier: 1, description: '4 Roca: Refleja el 20% del daño recibido al atacante.', onDefendReflect: 0.20 },
    { damageMultiplier: 1, description: '6 Roca: Refleja el 30% del daño recibido al atacante.', onDefendReflect: 0.30 },
  ]),
  makeSynergy('ghost', 'Espectro', [
    { damageMultiplier: 1, description: '2 Fantasma: ATK, SpA y SPD +1 por aliado caído al inicio de ronda.', roundStartBonusPerFallen: [{ key: 'attack', delta: 1 }, { key: 'special_attack', delta: 1 }, { key: 'speed', delta: 1 }] },
    { damageMultiplier: 1, description: '4 Fantasma: ATK, SpA y SPD +2 por aliado caído al inicio de ronda.', roundStartBonusPerFallen: [{ key: 'attack', delta: 2 }, { key: 'special_attack', delta: 2 }, { key: 'speed', delta: 2 }] },
    { damageMultiplier: 1, description: '6 Fantasma: ATK, SpA y SPD +3 por aliado caído al inicio de ronda.', roundStartBonusPerFallen: [{ key: 'attack', delta: 3 }, { key: 'special_attack', delta: 3 }, { key: 'speed', delta: 3 }] },
  ]),
  makeSynergy('dragon', 'Dragontide', [
    { damageMultiplier: 1, description: '2 Dragón: ATK, SpA, DEF y SpD +1×ronda al inicio de cada ronda.', roundStartBonusPerRound: [{ key: 'attack', delta: 1 }, { key: 'special_attack', delta: 1 }, { key: 'defense', delta: 1 }, { key: 'special_defense', delta: 1 }] },
    { damageMultiplier: 1, description: '4 Dragón: ATK, SpA, DEF y SpD +2×ronda al inicio de cada ronda.', roundStartBonusPerRound: [{ key: 'attack', delta: 2 }, { key: 'special_attack', delta: 2 }, { key: 'defense', delta: 2 }, { key: 'special_defense', delta: 2 }] },
    { damageMultiplier: 1, description: '6 Dragón: ATK, SpA, DEF y SpD +3×ronda al inicio de cada ronda.', roundStartBonusPerRound: [{ key: 'attack', delta: 3 }, { key: 'special_attack', delta: 3 }, { key: 'defense', delta: 3 }, { key: 'special_defense', delta: 3 }] },
  ]),
  makeSynergy('dark', 'Sombra', [
    { damageMultiplier: 1, description: '2 Siniestro: ATB inicia al 50%. Primer golpe resetea ATB rival.', roundStartAtbPercent: 0.5, firstHitResetEnemyAtb: true },
    { damageMultiplier: 1, description: '4 Siniestro: Lvl1 + esquiva el primer golpe enemigo.',            roundStartAtbPercent: 0.5, firstHitResetEnemyAtb: true, firstHitDodge: true },
    { damageMultiplier: 1, description: '6 Siniestro: Lvl2 + el primer golpe propio es crítico (×2).',    roundStartAtbPercent: 0.5, firstHitResetEnemyAtb: true, firstHitDodge: true, firstHitCritical: true },
  ]),
  makeSynergy('steel', 'Forja', [
    { damageMultiplier: 1, description: '2 Acero: Reduce el daño recibido entre 0% y 35% aleatoriamente.', onDefendDamageReduction: 0.35 },
    { damageMultiplier: 1, description: '4 Acero: Reduce el daño recibido entre 0% y 70% aleatoriamente.', onDefendDamageReduction: 0.70 },
    { damageMultiplier: 1, description: '6 Acero: Reduce el daño recibido entre 0% y 100% aleatoriamente.', onDefendDamageReduction: 1.00 },
  ]),
  makeSynergy('fairy', 'Encantamiento', [
    { damageMultiplier: 1, description: '2+ Hada: 30% al final de ronda de revivir un caído con 1HP (o curar al más débil 50%).', onRoundEndFairyChance: 0.30 },
    { damageMultiplier: 1, description: '4+ Hada: 60% al final de ronda de revivir un caído con 1HP (o curar al más débil 50%).', onRoundEndFairyChance: 0.60 },
    { damageMultiplier: 1, description: '6+ Hada: 90% al final de ronda de revivir un caído con 1HP (o curar al más débil 50%).', onRoundEndFairyChance: 0.90 },
  ]),
  makeSynergy('normal', 'Versatilidad', [
    { damageMultiplier: 1, description: '2+ Normal: 20% de prob. de recargar el ATB un 50% al atacar.', onAttackProc: { chance: 0.20, atbRefill: 50 } },
    { damageMultiplier: 1, description: '4+ Normal: 40% de prob. de recargar el ATB un 50% al atacar.', onAttackProc: { chance: 0.40, atbRefill: 50 } },
    { damageMultiplier: 1, description: '6+ Normal: 60% de prob. de recargar el ATB un 50% al atacar.', onAttackProc: { chance: 0.60, atbRefill: 50 } },
  ]),
]

type ActiveSynergy = { synergy: Synergy; level: 1 | 2 | 3 }

export class SynergyManager {
  private active: ActiveSynergy[] = []

  evaluate(team: PokemonInstance[]): void {
    this.active = SYNERGIES
      .map(s => ({ synergy: s, level: s.getLevel(team) }))
      .filter((r): r is ActiveSynergy => r.level > 0)
  }

  getDamageMultiplier(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => acc * synergy.effects[level - 1].damageMultiplier,
      1,
    )
  }

  getAttackProcs(): AttackProc[] {
    return this.active
      .flatMap(({ synergy, level }) => {
        const proc = synergy.effects[level - 1].onAttackProc
        return proc ? [{ ...proc, synergyName: synergy.name }] : []
      })
  }

  getRoundStartBonuses(): RoundStartBonus[] {
    return this.active.flatMap(({ synergy, level }) =>
      synergy.effects[level - 1].roundStartBonus ?? []
    )
  }

  getAttackBonuses(): OnAttackBonus[] {
    return this.active.flatMap(({ synergy, level }) =>
      synergy.effects[level - 1].onAttackBonus ?? []
    )
  }

  getAttackHealPercent(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => acc + (synergy.effects[level - 1].onAttackHeal ?? 0),
      0,
    )
  }

  getFallenBonuses(fallenCount: number): RoundStartBonus[] {
    if (fallenCount === 0) return []
    return this.active.flatMap(({ synergy, level }) =>
      (synergy.effects[level - 1].roundStartBonusPerFallen ?? []).map(b => ({
        key: b.key,
        delta: b.delta * fallenCount,
      }))
    )
  }

  getAttackAtbResets(): AttackAtbReset[] {
    return this.active.flatMap(({ synergy, level }) => {
      const r = synergy.effects[level - 1].onAttackAtbReset
      return r ? [{ chance: r.chance, target: r.target ?? 'enemy', synergyName: synergy.name }] : []
    })
  }

  getRoundEndLevelUpChance(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => Math.max(acc, synergy.effects[level - 1].onRoundEndLevelUp ?? 0),
      0,
    )
  }

  getAttackSplashPercent(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => acc + (synergy.effects[level - 1].onAttackSplash ?? 0),
      0,
    )
  }

  getRoundStartBonusesScaledByRound(round: number): RoundStartBonus[] {
    return this.active.flatMap(({ synergy, level }) =>
      (synergy.effects[level - 1].roundStartBonusPerRound ?? []).map(b => ({
        ...b,
        delta: b.delta * round,
      }))
    )
  }

  getDefendCounterAttackChance(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => Math.max(acc, synergy.effects[level - 1].onDefendCounterAttack ?? 0),
      0,
    )
  }

  getDefendDamageReductionMax(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => Math.max(acc, synergy.effects[level - 1].onDefendDamageReduction ?? 0),
      0,
    )
  }

  getDefendReflectPercent(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => acc + (synergy.effects[level - 1].onDefendReflect ?? 0),
      0,
    )
  }

  getAttackDebuffs(): AttackDebuff[] {
    return this.active.flatMap(({ synergy, level }) => {
      const d = synergy.effects[level - 1].onAttackDebuff
      return d ? [{ chance: d.chance, target: d.target ?? 'enemy', bonuses: d.bonuses, synergyName: synergy.name }] : []
    })
  }

  getRoundEndFairyChance(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => Math.max(acc, synergy.effects[level - 1].onRoundEndFairyChance ?? 0),
      0,
    )
  }

  getRoundStartAtbPercent(): number {
    return this.active.reduce(
      (acc, { synergy, level }) => Math.max(acc, synergy.effects[level - 1].roundStartAtbPercent ?? 0),
      0,
    )
  }

  hasFirstHitResetEnemyAtb(): boolean {
    return this.active.some(({ synergy, level }) => synergy.effects[level - 1].firstHitResetEnemyAtb === true)
  }

  hasFirstHitDodge(): boolean {
    return this.active.some(({ synergy, level }) => synergy.effects[level - 1].firstHitDodge === true)
  }

  hasFirstHitCritical(): boolean {
    return this.active.some(({ synergy, level }) => synergy.effects[level - 1].firstHitCritical === true)
  }

  getActive(): ActiveSynergy[] { return this.active }
}
