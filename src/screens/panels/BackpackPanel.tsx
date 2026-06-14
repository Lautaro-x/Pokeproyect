import { useState } from 'react'
import styles from './BackpackPanel.module.css'
import type { Item } from '../../game/entities/PokemonInstance'
import type { ConsumableStack } from '../../game/data/items'
import { ItemIcon } from '../../components/ItemIcon'

interface Props {
  equipables:  Item[]
  consumables: ConsumableStack[]
  onItemDrop?: (dragJson: string) => void
}

type Tab = 'equip' | 'consume'

const IconShield = () => (
  <svg viewBox="0 0 14 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1L1 4v4.5C1 12 3.5 14 7 15c3.5-1 6-3 6-6.5V4L7 1z" />
  </svg>
)

const IconFlask = () => (
  <svg viewBox="0 0 14 16" width="13" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4.5" y1="1" x2="9.5" y2="1" />
    <path d="M5.5 1v4.5L2 11c-1 2 .5 4 5 4s6-2 5-4L9.5 5.5V1" />
    <line x1="3" y1="10" x2="11" y2="10" strokeOpacity="0.5" strokeWidth="1" />
  </svg>
)

export function BackpackPanel({ equipables, consumables, onItemDrop }: Props) {
  const [tab,    setTab]    = useState<Tab>('equip')
  const [isOver, setIsOver] = useState(false)

  const acceptDrop = tab === 'equip'

  return (
    <div
      className={`${styles.panel} ${isOver && acceptDrop ? styles.over : ''}`}
      onDragOver={e => {
        if (!acceptDrop) return
        if (!e.dataTransfer.types.includes('itemdrag')) return
        e.preventDefault()
        setIsOver(true)
      }}
      onDragEnter={e => {
        if (!acceptDrop) return
        if (!e.dataTransfer.types.includes('itemdrag')) return
        e.preventDefault()
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false)
      }}
      onDrop={e => {
        e.preventDefault()
        setIsOver(false)
        if (!acceptDrop) return
        const json = e.dataTransfer.getData('itemdrag')
        if (!json) return
        const drag = JSON.parse(json)
        if (drag.source === 'pokemon') onItemDrop?.(json)
      }}
    >
      <div className={styles.title}>Mochila</div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'equip' ? styles.tabActive : ''}`}
          onClick={() => setTab('equip')}
          title="Equipables"
        >
          <IconShield />
        </button>
        <button
          className={`${styles.tab} ${tab === 'consume' ? styles.tabActive : ''}`}
          onClick={() => setTab('consume')}
          title="Consumibles"
        >
          <IconFlask />
        </button>
      </div>

      {/* ── Equipables ── */}
      {tab === 'equip' && (
        equipables.length === 0
          ? <span className={styles.empty}>Sin objetos</span>
          : <div className={styles.grid}>
              {equipables.map((item, idx) => (
                <div
                  key={idx}
                  className={styles.itemCell}
                  draggable={true}
                  onDragStart={e => {
                    e.dataTransfer.setData('itemdrag', JSON.stringify({ source: 'backpack', itemId: item.id }))
                    e.dataTransfer.effectAllowed = 'move'
                    const img = e.currentTarget.querySelector('img')
                    if (img) e.dataTransfer.setDragImage(img, 12, 12)
                  }}
                >
                  <ItemIcon item={item} size={24} />
                </div>
              ))}
            </div>
      )}

      {/* ── Consumibles ── */}
      {tab === 'consume' && (
        consumables.length === 0
          ? <span className={styles.empty}>Sin consumibles</span>
          : <div className={styles.grid}>
              {consumables.map(({ item, qty }) => (
                <div
                  key={item.id}
                  className={styles.itemCell}
                  draggable={qty > 0}
                  onDragStart={e => {
                    e.dataTransfer.setData('consumabledrag', JSON.stringify({ source: 'backpack', itemId: item.id }))
                    e.dataTransfer.effectAllowed = 'move'
                    const img = e.currentTarget.querySelector('img')
                    if (img) e.dataTransfer.setDragImage(img, 12, 12)
                  }}
                >
                  <ItemIcon item={item} size={24} />
                  <span className={styles.qtyBadge}>×{qty}</span>
                </div>
              ))}
            </div>
      )}
    </div>
  )
}
