import { useState, useRef, useLayoutEffect } from 'react'
import type { CSSProperties } from 'react'
import styles from './ItemIcon.module.css'
import type { Item } from '../game/entities/PokemonInstance'

interface Props {
  item: Item
  size?: number
  className?: string
  style?: CSSProperties
}

const PAD = 8

export function ItemIcon({ item, size = 16, className, style }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!anchor || !tip) return

    const { width: tw, height: th } = tip.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Default: above the item
    let top  = anchor.top - th - PAD
    let left = anchor.left + anchor.width / 2 - tw / 2

    // If doesn't fit above → show below
    if (top < PAD) top = anchor.bottom + PAD

    // Clamp horizontal
    left = Math.max(PAD, Math.min(left, vw - tw - PAD))
    // Clamp vertical (safety)
    top  = Math.max(PAD, Math.min(top,  vh - th - PAD))

    tip.style.left       = `${left}px`
    tip.style.top        = `${top}px`
    tip.style.visibility = 'visible'
  }, [anchor])

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${className ?? ''}`}
      style={style}
      onMouseEnter={() => {
        const r = wrapRef.current?.getBoundingClientRect()
        if (r) setAnchor(r)
      }}
      onMouseLeave={() => setAnchor(null)}
    >
      <img
        src={`/sprites/items/${item.sprite}`}
        alt={item.name}
        draggable={false}
        style={{ width: size, height: size }}
        className={styles.sprite}
      />

      {anchor && (
        <div ref={tipRef} className={styles.tooltip}>
          <div className={styles.header}>
            <img src={`/sprites/items/${item.sprite}`} alt="" className={styles.tipImg} />
            <span className={styles.tipName}>{item.name}</span>
          </div>
          {item.description && <p className={styles.tipDesc}>{item.description}</p>}
        </div>
      )}
    </div>
  )
}
