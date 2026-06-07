import { Container, Graphics } from 'pixi.js'

const BAR_H = 8

export class HPBar extends Container {
  private bar: Graphics
  private maxHp: number
  private barW: number

  constructor(maxHp: number, width = 100) {
    super()
    this.maxHp = maxHp
    this.barW = width

    const bg = new Graphics().rect(0, 0, width, BAR_H).fill(0x222233)
    this.bar = new Graphics().rect(0, 0, width, BAR_H).fill(0x44dd44)
    this.addChild(bg, this.bar)
  }

  update(currentHp: number): void {
    const pct = Math.max(0, currentHp / this.maxHp)
    const color = pct > 0.5 ? 0x44dd44 : pct > 0.25 ? 0xffcc00 : 0xff3333
    this.bar.clear().rect(0, 0, this.barW * pct, BAR_H).fill(color)
  }
}
