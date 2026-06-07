import type { Item } from '../entities/PokemonInstance'
import itemsJson from '../../assets/items.json'

export interface ConsumableStack {
  item: Item
  qty:  number
}

export const ALL_ITEMS: Item[] = itemsJson as Item[]

export const ALL_EQUIPABLES: Item[] = ALL_ITEMS.filter(i => !i.consumable)

export const ALL_CONSUMABLES: ConsumableStack[] = ALL_ITEMS
  .filter(i => i.consumable)
  .map(i => ({ item: i, qty: 3 }))
