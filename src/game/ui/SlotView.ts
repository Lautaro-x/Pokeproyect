import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { HPBar } from './HPBar'
import { ATBBar } from './ATBBar'
import { PokemonSprite } from './PokemonSprite'
import type { CombatSlot } from '../combat/CombatSlot'

export class SlotView extends Container {
  private playerSprite: PokemonSprite
  private enemySprite:  PokemonSprite
  private playerHp:  HPBar
  private enemyHp:   HPBar
  private playerAtb: ATBBar
  private enemyAtb:  ATBBar
  constructor(slot: CombatSlot, width: number, height: number) {
    super()

    const half = width / 2

    // Background
    const bg = new Graphics()
      .rect(0, 0, width, height)
      .fill({ color: 0x0f0e17 })
      .rect(0, 0, width, 1).fill(0x2a2a4a)               // top border
      .rect(half - 1, 4, 1, height - 8).fill(0x2a2a4a)   // center divider

    this.addChild(bg)

    const labelStyle = new TextStyle({ fill: 0x555577, fontSize: 9 })

    // --- PLAYER SIDE (left) ---
    this.playerSprite = new PokemonSprite(false)
    this.playerSprite.position.set(half * 0.35, height / 2 - 10)
    this.addChild(this.playerSprite)

    this.playerHp = new HPBar(slot.player?.instance.getMaxHp() ?? 1, Math.floor(half * 0.55))
    this.playerHp.position.set(half * 0.5 + 4, 6)
    this.addChild(this.playerHp)

    this.playerAtb = new ATBBar(Math.floor(half * 0.55))
    this.playerAtb.position.set(half * 0.5 + 4, 18)
    this.addChild(this.playerAtb)

    const pLabel = new Text({ text: 'TÚ', style: labelStyle })
    pLabel.position.set(6, 4)
    this.addChild(pLabel)

    // --- ENEMY SIDE (right) ---
    this.enemySprite = new PokemonSprite(true)
    this.enemySprite.position.set(half + half * 0.65, height / 2 - 10)
    this.addChild(this.enemySprite)

    this.enemyHp = new HPBar(slot.enemy?.instance.getMaxHp() ?? 1, Math.floor(half * 0.55))
    this.enemyHp.position.set(half + 4, 6)
    this.addChild(this.enemyHp)

    this.enemyAtb = new ATBBar(Math.floor(half * 0.55))
    this.enemyAtb.position.set(half + 4, 18)
    this.addChild(this.enemyAtb)

    const eLabel = new Text({ text: 'RIVAL', style: labelStyle })
    eLabel.position.set(half + 4, 4)
    this.addChild(eLabel)
  }

  async loadSprites(slot: CombatSlot): Promise<void> {
    if (slot.player) {
      const { data } = slot.player.instance
      await this.playerSprite.load(data.sprites.front, data.name)
    }
    if (slot.enemy) {
      const { data } = slot.enemy.instance
      await this.enemySprite.load(data.sprites.front, data.name)
    }
  }

  sync(slot: CombatSlot): void {
    if (slot.player) {
      this.playerHp.update(slot.player.currentHp)
      this.playerAtb.update(slot.player.getAtbPercent())
    }
    if (slot.enemy) {
      this.enemyHp.update(slot.enemy.currentHp)
      this.enemyAtb.update(slot.enemy.getAtbPercent())
    }
  }

  flashHit(side: 'player' | 'enemy'): void {
    if (side === 'player') this.playerSprite.playHitAnimation()
    else this.enemySprite.playHitAnimation()
  }

  faint(side: 'player' | 'enemy'): void {
    if (side === 'player') this.playerSprite.playFaintAnimation()
    else this.enemySprite.playFaintAnimation()
  }
}
