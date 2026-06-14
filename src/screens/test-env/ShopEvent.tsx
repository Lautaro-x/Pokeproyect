import { useState } from 'react'
import styles from './ShopEvent.module.css'
import { ALL_EQUIPABLES, ALL_CONSUMABLES } from '../../game/data/items'
import { ItemIcon } from '../../components/ItemIcon'
import { useGame } from '../../context/GameContext'
import type { Item } from '../../game/entities/PokemonInstance'

function weightedSample(pool: Item[], count: number): Item[] {
  const available = [...pool]
  const result: Item[] = []
  for (let i = 0; i < count && available.length > 0; i++) {
    const total = available.reduce((s, x) => s + (x.weight ?? 1), 0)
    let r = Math.random() * total
    for (let j = 0; j < available.length; j++) {
      r -= (available[j].weight ?? 1)
      if (r <= 0) { result.push(available[j]); available.splice(j, 1); break }
    }
  }
  return result
}

interface Props {
  onBack: () => void
}

export function ShopEvent({ onBack }: Props) {
  const { money, addEquipable, addConsumable, spendMoney } = useGame()

  const [shopEquips]   = useState<Item[]>(() => weightedSample(ALL_EQUIPABLES, 3))
  const [shopConsumes] = useState<Item[]>(() => weightedSample(ALL_CONSUMABLES.map(s => s.item), 3))
  const [soldEquips,   setSoldEquips]   = useState<Set<string>>(new Set())
  const [consumeStock, setConsumeStock] = useState<Record<string, number>>(
    () => Object.fromEntries(shopConsumes.map(i => [i.id, i.shopMaxQty ?? 1]))
  )

  const handleBuy = (item: Item, type: 'equip' | 'consume') => {
    const price = item.price ?? 0
    if (money < price) return
    if (type === 'equip' && soldEquips.has(item.id)) return
    if (type === 'consume' && (consumeStock[item.id] ?? 0) <= 0) return

    spendMoney(price)
    if (type === 'equip') {
      addEquipable(item)
      setSoldEquips(prev => new Set([...prev, item.id]))
    } else {
      addConsumable(item)
      setConsumeStock(prev => ({ ...prev, [item.id]: (prev[item.id] ?? 0) - 1 }))
    }
  }

  const renderCard = (item: Item, type: 'equip' | 'consume') => {
    const price     = item.price ?? 0
    const canAfford = money >= price
    const isSold    = type === 'equip'
      ? soldEquips.has(item.id)
      : (consumeStock[item.id] ?? 0) <= 0
    const disabled  = isSold || !canAfford
    const stockLeft = type === 'consume' ? (consumeStock[item.id] ?? 0) : null

    return (
      <button
        key={item.id}
        className={`${styles.card} ${isSold ? styles.sold : ''} ${!canAfford && !isSold ? styles.poor : ''}`}
        onClick={() => handleBuy(item, type)}
        disabled={disabled}
        title={item.description}
      >
        {isSold && (
          <div className={styles.soldOverlay}>
            <span className={styles.soldStamp}>SOLD</span>
          </div>
        )}
        <div className={styles.cardIcon}>
          <ItemIcon item={item} size={36} />
        </div>
        <span className={styles.cardName}>{item.name}</span>
        {stockLeft !== null && (
          <span className={styles.cardStock}>×{stockLeft}</span>
        )}
        <span className={`${styles.cardPrice} ${!canAfford && !isSold ? styles.priceRed : ''}`}>
          <svg viewBox="0 0 12 18" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="0" x2="3" y2="11"/>
            <path d="M3 0 Q9.5 0 9.5 3.5 Q9.5 7 3 7"/>
            <line x1="0.5" y1="8.5"  x2="10" y2="8.5"/>
            <line x1="0.5" y1="10.5" x2="10" y2="10.5"/>
          </svg>
          {price.toLocaleString('es-ES')}
        </span>
      </button>
    )
  }

  return (
    <div className={styles.shop}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
        <span className={styles.title}>Tienda Pokémon</span>
      </div>

      <div className={styles.scenery}>
        <img src="/scenery/shop.png" alt="" className={styles.shopImg} draggable={false} />
      </div>

      <div className={styles.catalog}>
        <section className={styles.section}>
          <div className={styles.row}>
            {shopEquips.map(item => renderCard(item, 'equip'))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.row}>
            {shopConsumes.map(item => renderCard(item, 'consume'))}
          </div>
        </section>
      </div>
    </div>
  )
}
