import { Container, Sprite, Assets, Text, TextStyle } from 'pixi.js'
import { AnimatedGIF } from '@pixi/gif'

export class PokemonSprite extends Container {
  private sprite: Sprite | AnimatedGIF | null = null
  private nameLabel: Text
  private isEnemy: boolean

  constructor(isEnemy: boolean) {
    super()
    this.isEnemy = isEnemy

    const style = new TextStyle({ fill: 0xffffff, fontSize: 11 })
    this.nameLabel = new Text({ text: '', style })
    this.nameLabel.anchor.set(0.5, 0)
    this.nameLabel.y = 68
    this.addChild(this.nameLabel)
  }

  async load(spriteUrl: string | null, name: string): Promise<void> {
    this.nameLabel.text = name
    if (!spriteUrl) return

    try {
      const asset = await Assets.load(spriteUrl)
      if (this.sprite) this.removeChild(this.sprite)

      if (asset instanceof AnimatedGIF) {
        this.sprite = asset
        asset.play()
      } else {
        this.sprite = new Sprite(asset)
      }

      this.sprite.anchor.set(0.5)
      this.sprite.scale.set(this.isEnemy ? -1.5 : 1.5, 1.5)
      this.addChild(this.sprite)
    } catch {
      // sprite not available, nameLabel only
    }
  }

  playHitAnimation(): void {
    if (!this.sprite) return
    this.sprite.tint = 0xff4444
    setTimeout(() => { if (this.sprite) this.sprite.tint = 0xffffff }, 150)
  }

  playFaintAnimation(): void {
    if (!this.sprite) return
    const fade = setInterval(() => {
      if (!this.sprite) { clearInterval(fade); return }
      this.sprite.alpha -= 0.05
      if (this.sprite.alpha <= 0) clearInterval(fade)
    }, 30)
  }
}
