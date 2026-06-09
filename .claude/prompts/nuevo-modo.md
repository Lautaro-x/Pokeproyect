# Prompt: Nuevo modo de juego

**Usar cuando el usuario diga algo como:** "crea un nuevo modo de juego bajo el nombre X" / "añade el modo X al menú"

---

## Contexto del proyecto

Stack: React + TypeScript + Vite. Estilos con CSS Modules.

### Archivos a tocar siempre (3 en total)

| Archivo | Qué hacer |
|---|---|
| `src/App.tsx` | Añadir `import` del nuevo screen y `<Route path="/X" element={<X />} />` |
| `src/screens/MenuScreen.tsx` | Añadir `<button className={\`${styles.btn} ${styles.btnSecondary}\`} onClick={() => navigate('/X')}>Nombre</button>` dentro de `<nav className={styles.menu}>` |
| `src/screens/NombreScreen.tsx` | Crear desde cero (ver plantilla abajo) |

### Archivos a crear siempre (2 en total)

- `src/screens/NombreScreen.tsx`
- `src/screens/NombreScreen.module.css`

---

## Plantilla: NombreScreen.tsx

```tsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './NombreScreen.module.css'
import { TeamPanel } from './panels/TeamPanel'
import { BackpackPanel } from './panels/BackpackPanel'
import { SynergyPanel } from './panels/SynergyPanel'
import { PokemonInstance } from '../game/entities/PokemonInstance'
import type { Item } from '../game/entities/PokemonInstance'
import type { ConsumableStack } from '../game/data/items'

export default function NombreScreen() {
  const navigate = useNavigate()

  const [playerTeam,  setPlayerTeam]  = useState<PokemonInstance[]>([])
  const [backpack,    setBackpack]    = useState<Item[]>([])
  const [consumables, setConsumables] = useState<ConsumableStack[]>([])

  const placedIndices  = useMemo(() => new Set<number>(), [])
  const faintedIndices = useMemo(() => new Set<number>(), [])

  const handleReorder = (from: number, to: number) => {
    setPlayerTeam(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const handleItemDrop = (dragJson: string, toTeamIdx: number) => {
    try {
      const item: Item = JSON.parse(dragJson)
      setPlayerTeam(prev => prev.map((p, i) => {
        if (i !== toTeamIdx) return p
        const clone = Object.assign(Object.create(Object.getPrototypeOf(p)), p)
        clone.equippedItem = item
        return clone
      }))
      setBackpack(prev => prev.filter(it => it.id !== item.id))
    } catch { /* ignore */ }
  }

  const handleConsumableDrop = (dragJson: string, _toTeamIdx: number) => {
    try {
      const { id } = JSON.parse(dragJson) as { id: string }
      setConsumables(prev =>
        prev.map(s => s.item.id === id && s.count > 0 ? { ...s, count: s.count - 1 } : s)
      )
    } catch { /* ignore */ }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.gameGroup}>

        <div className={styles.leftPanel}>
          <TeamPanel
            team={playerTeam}
            placedIndices={placedIndices}
            faintedIndices={faintedIndices}
            locked={false}
            onBack={() => navigate('/')}
            onReorder={handleReorder}
            onItemDrop={handleItemDrop}
            onConsumableDrop={handleConsumableDrop}
          />
        </div>

        <div className={styles.gameBox}>
          {/* contenido específico del modo */}
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.rightCard}>
            <BackpackPanel equipables={backpack} consumables={consumables} />
          </div>
          <div className={styles.rightCard}>
            <SynergyPanel playerTeam={playerTeam} enemyTeam={[]} />
          </div>
        </div>

      </div>
    </div>
  )
}
```

---

## Plantilla: NombreScreen.module.css

```css
.screen {
  width: 100vw;
  height: 100vh;
  background: #07070f;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.gameGroup {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: calc(100vh - 24px);
  gap: 8px;
}

.leftPanel {
  width: 170px;
  flex-shrink: 0;
  border-radius: 14px;
  overflow: hidden;
  background: #0d0d1f;
}

.gameBox {
  width: 540px;
  flex-shrink: 0;
  border-radius: 16px;
  overflow: hidden;
  background: #0f0e17;
  box-shadow: 0 0 50px #000c;
  display: flex;
  flex-direction: column;
  position: relative;
}

.rightPanel {
  width: 160px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rightCard {
  flex: 1;
  border-radius: 14px;
  overflow: hidden;
}
```

---

## Notas

- `backpack` y `consumables` arrancan vacíos `[]` por defecto. Rellenar con `ALL_EQUIPABLES` / `ALL_CONSUMABLES` solo si el modo lo requiere.
- El `gameBox` es el único bloque que cambia entre modos. Todo lo demás es idéntico.
- El botón en el menú usa `styles.btnSecondary` (ya existe en `MenuScreen.module.css`).
- Ruta sugerida: kebab-case del nombre (`/nombre-del-modo`).
