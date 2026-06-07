import { Container, Graphics } from 'pixi.js'

const BAR_H = 5

export class ATBBar extends Container {
  private bar: Graphics
  private barW: number

  constructor(width = 100) {
    super()
    this.barW = width
    const bg = new Graphics().rect(0, 0, width, BAR_H).fill(0x1a1a2e)
    this.bar = new Graphics()
    this.addChild(bg, this.bar)
  }

  update(percent: number): void {
    const pct = Math.max(0, Math.min(1, percent / 100))
    this.bar.clear().rect(0, 0, this.barW * pct, BAR_H).fill(0xffd700)
  }
}
