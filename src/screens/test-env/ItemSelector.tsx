import styles from './ItemSelector.module.css'
import { ALL_EQUIPABLES, ALL_CONSUMABLES } from '../../game/data/items'
import { ItemIcon } from '../../components/ItemIcon'
import type { Item } from '../../game/entities/PokemonInstance'
import type { ConsumableStack } from '../../game/data/items'

interface Props {
  onBack:            () => void
  backpack:          Item[]
  consumables:       ConsumableStack[]
  onAddEquipable:    (item: Item) => void
  onAddConsumable:   (item: Item) => void
}

export function ItemSelector({ onBack, backpack, consumables, onAddEquipable, onAddConsumable }: Props) {
  const backpackIds  = new Set(backpack.map(i => i.id))
  const consumableQty = (id: string) => consumables.find(s => s.item.id === id)?.qty ?? 0

  return (
    <div className={styles.selector}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Volver</button>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Equipables</h3>
          <div className={styles.grid}>
            {ALL_EQUIPABLES.map(item => {
              const owned = backpackIds.has(item.id)
              return (
                <button
                  key={item.id}
                  className={`${styles.itemBtn} ${owned ? styles.owned : ''}`}
                  onClick={() => !owned && onAddEquipable(item)}
                  title={item.description}
                >
                  <ItemIcon item={item} size={22} />
                  <span className={styles.itemName}>{item.name}</span>
                  {owned && <span className={styles.ownedBadge}>✓</span>}
                </button>
              )
            })}
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Consumibles</h3>
          <div className={styles.grid}>
            {ALL_CONSUMABLES.map(({ item }) => {
              const qty = consumableQty(item.id)
              return (
                <button
                  key={item.id}
                  className={styles.itemBtn}
                  onClick={() => onAddConsumable(item)}
                  title={item.description}
                >
                  <ItemIcon item={item} size={22} />
                  <span className={styles.itemName}>{item.name}</span>
                  {qty > 0 && <span className={styles.qtyBadge}>×{qty}</span>}
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
