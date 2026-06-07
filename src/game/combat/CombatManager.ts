import { CombatSlot } from './CombatSlot'
import { DamageCalculator } from './DamageCalculator'
import { SynergyManager } from './SynergyManager'
import type { CombatPokemon } from '../entities/CombatPokemon'
import type { BonusKey, StatBonuses } from '../entities/CombatPokemon'
import type { PokemonInstance } from '../entities/PokemonInstance'
import type { AttackEvent, CombatState, RoundEndEvent } from '../../types'

type EventMap = {
  attack: AttackEvent
  round_end: RoundEndEvent
  game_over: { playerWins: boolean }
  synergy_proc: { slotIndex: number; side: 'player' | 'enemy'; synergyName: string }
  bonus_change: {
    slotIndex: number
    side: 'player' | 'enemy'
    key: BonusKey
    delta: number
    newLevel: number
    allBonuses: StatBonuses
  }
  level_up: { slotIndex: number; side: 'player' | 'enemy'; newLevel: number }
}

type Listener<K extends keyof EventMap> = (data: EventMap[K]) => void

const TYPE_BOOST_ITEMS: Record<string, string> = {
  'silk-scarf':     'normal',
  'charcoal':       'fire',
  'mystic-water':   'water',
  'magnet':         'electric',
  'miracle-seed':   'grass',
  'never-melt-ice': 'ice',
  'black-belt':     'fighting',
  'poison-barb':    'poison',
  'soft-sand':      'ground',
  'sharp-beak':     'flying',
  'twisted-spoon':  'psychic',
  'silver-powder':  'bug',
  'hard-stone':     'rock',
  'spell-tag':      'ghost',
  'dragon-fang':    'dragon',
  'black-glasses':  'dark',
  'metal-coat':     'steel',
  'fairy-feather':  'fairy',
}

function getTypeBoostMult(attacker: CombatPokemon): number {
  const id = attacker.instance.equippedItem?.id
  if (!id) return 1
  const boostedType = TYPE_BOOST_ITEMS[id]
  if (!boostedType) return 1
  return boostedType === attacker.instance.getEffectiveType() ? 1.4 : 1
}

export class CombatManager {
  slots: CombatSlot[]
  state: CombatState
  round: number

  private playerSynergy: SynergyManager
  private enemySynergy: SynergyManager
  private listeners: { [K in keyof EventMap]?: Listener<K>[] } = {}

  constructor() {
    this.slots = []
    this.state = 'positioning'
    this.round = 1
    this.playerSynergy = new SynergyManager()
    this.enemySynergy = new SynergyManager()
  }

  on<K extends keyof EventMap>(event: K, listener: Listener<K>): void {
    if (!this.listeners[event]) this.listeners[event] = []
    ;(this.listeners[event] as Listener<K>[]).push(listener)
  }

  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    (this.listeners[event] as Listener<K>[] | undefined)?.forEach(l => l(data))
  }

  setupRound(
    playerCombatants: (CombatPokemon | null)[],
    enemyCombatants: (CombatPokemon | null)[],
    playerTeam: PokemonInstance[],
    enemyTeam: PokemonInstance[]
  ): void {
    const maxSlots = Math.max(playerCombatants.length, enemyCombatants.length)
    this.slots = Array.from({ length: maxSlots }, (_, i) =>
      new CombatSlot(i, playerCombatants[i] ?? null, enemyCombatants[i] ?? null)
    )
    this.playerSynergy.evaluate(playerTeam)
    this.enemySynergy.evaluate(enemyTeam)
    this.state = 'fighting'
  }

  tick(deltaMs: number): void {
    if (this.state !== 'fighting') return

    for (const slot of this.slots) {
      if (!slot.isActive()) continue

      const { player, enemy } = slot

      if (player && !player.isDefeated) {
        if (player.tick(deltaMs) && enemy && !enemy.isDefeated) {
          if (enemy.firstHitDodge) {
            enemy.firstHitDodge = false
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: 'Sombra' })
          } else {
          const { damage: base, effectiveness } = DamageCalculator.calculate(player, enemy)
          const isCritPlayer = player.firstHitCritical
          const critMult = isCritPlayer ? 2 : 1
          if (player.firstHitCritical) player.firstHitCritical = false
          const lifeOrbP   = player.instance.equippedItem?.id === 'life-orb'   ? 1.4 : 1
          const metronomeP = player.instance.equippedItem?.id === 'metronome' ? 1.2 : 1
          const typeBoostP = getTypeBoostMult(player)
          const rawDamage = Math.max(1, Math.floor(base * this.playerSynergy.getDamageMultiplier() * critMult * lifeOrbP * metronomeP * typeBoostP))
          const enemyGhost = this.enemySynergy.getDefendDamageReductionMax()
          const damage = enemyGhost > 0 ? Math.max(1, Math.floor(rawDamage * (1 - Math.random() * enemyGhost))) : rawDamage
          enemy.takeDamage(damage)
          this.emit('attack', {
            attackerName: player.instance.data.name,
            defenderName: enemy.instance.data.name,
            damage,
            typeEffectiveness: effectiveness,
            slotIndex: slot.index,
            side: 'player',
            isCritical: isCritPlayer,
          })
          if (player.firstHitAtbReset) {
            player.firstHitAtbReset = false
            enemy.atbProgress = 0
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: 'Sombra' })
          }
          for (const proc of this.playerSynergy.getAttackProcs()) {
            if (Math.random() < proc.chance) {
              player.atbProgress = Math.min(100, player.atbProgress + proc.atbRefill)
              this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: proc.synergyName })
            }
          }
          for (const bonus of this.playerSynergy.getAttackBonuses()) {
            this.applyBonus(bonus.target === 'enemy' ? 'enemy' : 'player', slot.index, bonus.key, bonus.delta)
          }
          const playerHealPct = this.playerSynergy.getAttackHealPercent()
          if (playerHealPct > 0) player.heal(Math.max(1, Math.floor(damage * playerHealPct)))
          for (const reset of this.playerSynergy.getAttackAtbResets()) {
            if (Math.random() < reset.chance) {
              const tgt = reset.target === 'self' ? player : enemy
              tgt.atbProgress = 0
              this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: reset.synergyName })
            }
          }
          for (const debuff of this.playerSynergy.getAttackDebuffs()) {
            if (Math.random() < debuff.chance) {
              const side = debuff.target === 'enemy' ? 'enemy' : 'player'
              for (const b of debuff.bonuses)
                this.applyBonus(side, slot.index, b.key, b.delta)
              this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: debuff.synergyName })
            }
          }
          const playerSplash = this.playerSynergy.getAttackSplashPercent()
          if (playerSplash > 0) {
            const splashDmg = Math.max(1, Math.floor(damage * playerSplash))
            for (const other of this.slots) {
              if (other.index !== slot.index && other.isActive())
                other.enemy!.takeDamage(splashDmg)
            }
          }
          const enemyReflect = this.enemySynergy.getDefendReflectPercent()
          if (enemyReflect > 0)
            player.takeDamage(Math.max(1, Math.floor(damage * enemyReflect)))
          const enemyCounter = this.enemySynergy.getDefendCounterAttackChance()
          if (enemyCounter > 0 && !enemy.isDefeated && Math.random() < enemyCounter) {
            const { damage: cDmg } = DamageCalculator.calculate(enemy, player)
            player.takeDamage(Math.max(1, cDmg))
            enemy.atbProgress = Math.max(0, enemy.atbProgress - 20)
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: 'Contraataque' })
          }
          if (enemy.instance.equippedItem?.id === 'rocky-helmet' && !player.isDefeated) {
            player.takeDamage(Math.max(1, Math.floor(player.instance.getMaxHp() * 0.10)))
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: 'Casco Dentado' })
          }
          if (player.instance.equippedItem?.id === 'leftovers') {
            player.heal(Math.max(1, Math.floor(player.instance.getMaxHp() * 0.10)))
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: 'Restos' })
          }
          if (player.instance.equippedItem?.id === 'life-orb') {
            player.takeDamage(Math.max(1, Math.floor(player.instance.getMaxHp() * 0.10)))
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: 'Vidasfera' })
          }
          } // end else (enemy dodge check)
        }
      }

      if (enemy && !enemy.isDefeated) {
        if (enemy.tick(deltaMs) && player && !player.isDefeated) {
          if (player.firstHitDodge) {
            player.firstHitDodge = false
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: 'Sombra' })
          } else {
          const { damage: base, effectiveness } = DamageCalculator.calculate(enemy, player)
          const isCritEnemy = enemy.firstHitCritical
          const eCritMult = isCritEnemy ? 2 : 1
          if (enemy.firstHitCritical) enemy.firstHitCritical = false
          const lifeOrbE   = enemy.instance.equippedItem?.id === 'life-orb'   ? 1.4 : 1
          const metronomeE = enemy.instance.equippedItem?.id === 'metronome' ? 1.2 : 1
          const typeBoostE = getTypeBoostMult(enemy)
          const rawDamage = Math.max(1, Math.floor(base * this.enemySynergy.getDamageMultiplier() * eCritMult * lifeOrbE * metronomeE * typeBoostE))
          const playerGhost = this.playerSynergy.getDefendDamageReductionMax()
          const damage = playerGhost > 0 ? Math.max(1, Math.floor(rawDamage * (1 - Math.random() * playerGhost))) : rawDamage
          player.takeDamage(damage)
          this.emit('attack', {
            attackerName: enemy.instance.data.name,
            defenderName: player.instance.data.name,
            damage,
            typeEffectiveness: effectiveness,
            slotIndex: slot.index,
            side: 'enemy',
            isCritical: isCritEnemy,
          })
          if (enemy.firstHitAtbReset) {
            enemy.firstHitAtbReset = false
            player.atbProgress = 0
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: 'Sombra' })
          }
          for (const proc of this.enemySynergy.getAttackProcs()) {
            if (Math.random() < proc.chance) {
              enemy.atbProgress = Math.min(100, enemy.atbProgress + proc.atbRefill)
              this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: proc.synergyName })
            }
          }
          for (const bonus of this.enemySynergy.getAttackBonuses()) {
            this.applyBonus(bonus.target === 'enemy' ? 'player' : 'enemy', slot.index, bonus.key, bonus.delta)
          }
          const enemyHealPct = this.enemySynergy.getAttackHealPercent()
          if (enemyHealPct > 0) enemy.heal(Math.max(1, Math.floor(damage * enemyHealPct)))
          for (const reset of this.enemySynergy.getAttackAtbResets()) {
            if (Math.random() < reset.chance) {
              const tgt = reset.target === 'self' ? enemy : player
              tgt.atbProgress = 0
              this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: reset.synergyName })
            }
          }
          for (const debuff of this.enemySynergy.getAttackDebuffs()) {
            if (Math.random() < debuff.chance) {
              const side = debuff.target === 'enemy' ? 'player' : 'enemy'
              for (const b of debuff.bonuses)
                this.applyBonus(side, slot.index, b.key, b.delta)
              this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: debuff.synergyName })
            }
          }
          const enemySplash = this.enemySynergy.getAttackSplashPercent()
          if (enemySplash > 0) {
            const splashDmg = Math.max(1, Math.floor(damage * enemySplash))
            for (const other of this.slots) {
              if (other.index !== slot.index && other.isActive())
                other.player!.takeDamage(splashDmg)
            }
          }
          const playerReflect = this.playerSynergy.getDefendReflectPercent()
          if (playerReflect > 0)
            enemy.takeDamage(Math.max(1, Math.floor(damage * playerReflect)))
          const playerCounter = this.playerSynergy.getDefendCounterAttackChance()
          if (playerCounter > 0 && !player.isDefeated && Math.random() < playerCounter) {
            const { damage: cDmg } = DamageCalculator.calculate(player, enemy)
            enemy.takeDamage(Math.max(1, cDmg))
            player.atbProgress = Math.max(0, player.atbProgress - 20)
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: 'Contraataque' })
          }
          if (player.instance.equippedItem?.id === 'rocky-helmet' && !enemy.isDefeated) {
            enemy.takeDamage(Math.max(1, Math.floor(enemy.instance.getMaxHp() * 0.10)))
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'player', synergyName: 'Casco Dentado' })
          }
          if (enemy.instance.equippedItem?.id === 'leftovers') {
            enemy.heal(Math.max(1, Math.floor(enemy.instance.getMaxHp() * 0.10)))
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: 'Restos' })
          }
          if (enemy.instance.equippedItem?.id === 'life-orb') {
            enemy.takeDamage(Math.max(1, Math.floor(enemy.instance.getMaxHp() * 0.10)))
            this.emit('synergy_proc', { slotIndex: slot.index, side: 'enemy', synergyName: 'Vidasfera' })
          }
          } // end else (dodge check)
        }
      }

      slot.checkResolution()
    }

    this.checkRoundEnd()
  }

  startRound(playerFallen = 0, enemyFallen = 0): void {
    const playerBonuses = [
      ...this.playerSynergy.getRoundStartBonuses(),
      ...this.playerSynergy.getFallenBonuses(playerFallen),
      ...this.playerSynergy.getRoundStartBonusesScaledByRound(this.round),
    ]
    const enemyBonuses = [
      ...this.enemySynergy.getRoundStartBonuses(),
      ...this.enemySynergy.getFallenBonuses(enemyFallen),
      ...this.enemySynergy.getRoundStartBonusesScaledByRound(this.round),
    ]
    for (let si = 0; si < this.slots.length; si++) {
      for (const { key, delta, target } of playerBonuses)
        this.applyBonus(target === 'enemy' ? 'enemy' : 'player', si, key, delta)
      for (const { key, delta, target } of enemyBonuses)
        this.applyBonus(target === 'enemy' ? 'player' : 'enemy', si, key, delta)
    }

    const pAtbPct  = this.playerSynergy.getRoundStartAtbPercent()
    const pResetAtb = this.playerSynergy.hasFirstHitResetEnemyAtb()
    const pDodge   = this.playerSynergy.hasFirstHitDodge()
    const pCrit    = this.playerSynergy.hasFirstHitCritical()
    const eAtbPct  = this.enemySynergy.getRoundStartAtbPercent()
    const eResetAtb = this.enemySynergy.hasFirstHitResetEnemyAtb()
    const eDodge   = this.enemySynergy.hasFirstHitDodge()
    const eCrit    = this.enemySynergy.hasFirstHitCritical()

    for (const s of this.slots) {
      if (s.player && !s.player.isDefeated) {
        if (pAtbPct > 0) s.player.atbProgress = pAtbPct * 100
        s.player.firstHitAtbReset = pResetAtb
        s.player.firstHitDodge    = pDodge
        s.player.firstHitCritical = pCrit
      }
      if (s.enemy && !s.enemy.isDefeated) {
        if (eAtbPct > 0) s.enemy.atbProgress = eAtbPct * 100
        s.enemy.firstHitAtbReset = eResetAtb
        s.enemy.firstHitDodge    = eDodge
        s.enemy.firstHitCritical = eCrit
      }
    }
  }

  applyBonus(side: 'player' | 'enemy', slotIndex: number, key: BonusKey, delta: number): void {
    const slot = this.slots[slotIndex]
    if (!slot) return
    const pokemon = side === 'player' ? slot.player : slot.enemy
    if (!pokemon || pokemon.isDefeated) return
    pokemon.addBonus(key, delta)
    this.emit('bonus_change', {
      slotIndex,
      side,
      key,
      delta,
      newLevel: pokemon.bonuses[key],
      allBonuses: { ...pokemon.bonuses },
    })
  }

  getPlayerFairyChance(): number { return this.playerSynergy.getRoundEndFairyChance() }
  getEnemyFairyChance():  number { return this.enemySynergy.getRoundEndFairyChance()  }

  private checkRoundEnd(): void {
    const allResolved = this.slots.every(s => !s.isActive())
    if (!allResolved) return

    const playerLvChance = this.playerSynergy.getRoundEndLevelUpChance()
    const enemyLvChance  = this.enemySynergy.getRoundEndLevelUpChance()
    for (const s of this.slots) {
      if (playerLvChance > 0 && s.player && !s.player.isDefeated && Math.random() < playerLvChance) {
        s.player.instance.setLevel(s.player.instance.level + 1)
        this.emit('level_up', { slotIndex: s.index, side: 'player', newLevel: s.player.instance.level })
      }
      if (enemyLvChance > 0 && s.enemy && !s.enemy.isDefeated && Math.random() < enemyLvChance) {
        s.enemy.instance.setLevel(s.enemy.instance.level + 1)
        this.emit('level_up', { slotIndex: s.index, side: 'enemy', newLevel: s.enemy.instance.level })
      }
      if (s.status === 'player_won' && s.player && s.player.instance.equippedItem?.id === 'lucky-egg' && Math.random() < 0.30) {
        s.player.instance.setLevel(s.player.instance.level + 1)
        this.emit('level_up', { slotIndex: s.index, side: 'player', newLevel: s.player.instance.level })
      }
      if (s.status === 'enemy_won' && s.enemy && s.enemy.instance.equippedItem?.id === 'lucky-egg' && Math.random() < 0.30) {
        s.enemy.instance.setLevel(s.enemy.instance.level + 1)
        this.emit('level_up', { slotIndex: s.index, side: 'enemy', newLevel: s.enemy.instance.level })
      }
    }

    const playerWins = this.slots.filter(s => s.status === 'player_won').length
    const enemyWins  = this.slots.filter(s => s.status === 'enemy_won').length

    this.state = 'round_end'
    this.round++
    this.emit('round_end', { playerWins, enemyWins })
  }
}
