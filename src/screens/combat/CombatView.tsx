import { useEffect, useRef } from 'react'
import { Application, extensions } from 'pixi.js'
import { AnimatedGIFAsset } from '@pixi/gif'
import { CombatManager } from '../../game/combat/CombatManager'
import { CombatPokemon } from '../../game/entities/CombatPokemon'
import { SlotView } from '../../game/ui/SlotView'
import type { PokemonInstance } from '../../game/entities/PokemonInstance'

interface Props {
  playerPlacements: (PokemonInstance | null)[]
  enemyTeam: PokemonInstance[]
  onRoundEnd: () => void
}

export function CombatView({ playerPlacements, enemyTeam, onRoundEnd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let app: Application
    let destroyed = false

    async function init() {
      extensions.add(AnimatedGIFAsset)

      const rect = containerRef.current!.getBoundingClientRect()
      app = new Application()
      await app.init({
        width: rect.width,
        height: rect.height,
        background: 0x0f0e17,
        antialias: true,
      })

      if (destroyed) { app.destroy(); return }
      containerRef.current!.appendChild(app.canvas)

      const playerCombatants = playerPlacements.map(p => p ? new CombatPokemon(p) : null)
      const enemyCombatants  = enemyTeam.map((_, i) =>
        i < 6 ? new CombatPokemon(enemyTeam[i]) : null
      )

      const manager = new CombatManager()
      manager.setupRound(
        playerCombatants,
        enemyCombatants,
        playerPlacements.filter(Boolean) as PokemonInstance[],
        enemyTeam
      )

      // Layout: 6 slots stacked vertically
      const SLOT_H = Math.floor(rect.height / 6)
      const SLOT_W = rect.width
      const slotViews: SlotView[] = []

      for (const slot of manager.slots) {
        const view = new SlotView(slot, SLOT_W, SLOT_H)
        view.position.set(0, slot.index * SLOT_H)
        app.stage.addChild(view)
        slotViews.push(view)
        await view.loadSprites(slot)
      }

      manager.on('attack', ({ slotIndex, side }) => {
        const defender = side === 'player' ? 'enemy' : 'player'
        slotViews[slotIndex]?.flashHit(defender)
        const slot = manager.slots[slotIndex]
        const target = defender === 'player' ? slot.player : slot.enemy
        if (target?.isDefeated) slotViews[slotIndex]?.faint(defender)
      })

      manager.on('round_end', () => {
        setTimeout(onRoundEnd, 1500)
      })

      app.ticker.add(ticker => {
        manager.tick(ticker.deltaMS)
        manager.slots.forEach((slot, i) => slotViews[i]?.sync(slot))
      })
    }

    init().catch(console.error)

    return () => {
      destroyed = true
      try { app?.destroy(true) } catch { /* */ }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
