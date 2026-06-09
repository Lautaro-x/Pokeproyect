import { useEffect, useRef, useMemo, useState } from 'react'
import styles from './NodeMap.module.css'
import type { MapData, MapNode } from './mapGenerator'

const W        = 480
const FLOOR_H  = 88
const R        = 19
const NODE_GAP = 120
const PAD_V    = R + 12

interface Props {
  map:          MapData
  completedIds: Set<string>
  currentId:    string | null
  reachableIds: Set<string>
  onNodeClick:  (node: MapNode) => void
}

function TrainerIcon({ x, y, sprite }: { x: number; y: number; sprite: string }) {
  return (
    <image
      href={`/sprites/others/${sprite}`}
      x={x - R * 1.5} y={y - R * 1.5}
      width={R * 3} height={R * 3}
      style={{ pointerEvents: 'none', imageRendering: 'pixelated' }}
    />
  )
}

interface TooltipInfo {
  node: MapNode
  x: number
  y: number
}

function tooltipContent(node: MapNode): { title: string; reward?: string } {
  switch (node.type) {
    case 'start':          return { title: 'Inicio' }
    case 'pokemon-center': return { title: 'Centro Pokémon' }
    case 'shop':           return { title: 'Tienda' }
    case 'wild':           return { title: 'Combate salvaje', reward: 'Captura · +1 lvl' }
    case 'wild_plus_mt':   return { title: 'Combate salvaje', reward: 'Captura/MT · +1 lvl' }
    case 'trainer':        return { title: 'Entrenador', reward: 'Pokédólares · +2 lvls' }
    case 'boss':           return { title: 'Gimnasio', reward: 'Insignia · +2 lvls' }
    case 'random':         return { title: 'Evento' }
  }
}

export function NodeMap({ map, completedIds, currentId, reachableIds, onNodeClick }: Props) {
  const canvasH      = map.totalFloors * FLOOR_H
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (currentId === null) { el.scrollTop = el.scrollHeight; return }
    const node = map.nodes[currentId]
    const yPos = nodeY(node.floor)
    el.scrollTop = yPos - el.clientHeight * 0.6
  }, [currentId, map])  // eslint-disable-line react-hooks/exhaustive-deps

  function nodeX(node: MapNode): number {
    if (node.totalCols === 1) return W / 2
    const totalWidth = (node.totalCols - 1) * NODE_GAP
    return W / 2 - totalWidth / 2 + node.col * NODE_GAP
  }

  function nodeY(floor: number): number {
    const usable = canvasH - PAD_V * 2
    return canvasH - PAD_V - (floor / (map.totalFloors - 1)) * usable
  }

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    for (const node of Object.values(map.nodes)) {
      pos[node.id] = { x: nodeX(node), y: nodeY(node.floor) }
    }
    return pos
  }, [map])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edges ──────────────────────────────────────────────────────────────────
  const edges = Object.values(map.nodes).flatMap(node =>
    node.nextIds.map(nxtId => {
      const { x: x1, y: y1 } = positions[node.id]
      const { x: x2, y: y2 } = positions[nxtId]
      const traversed = completedIds.has(node.id) && completedIds.has(nxtId)
      return (
        <line
          key={`${node.id}→${nxtId}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={traversed ? '#cc2233' : '#ffffff'}
          strokeWidth={traversed ? 2 : 1.5}
        />
      )
    })
  )

  // ── Max floor reached (for darkening skipped nodes) ─────────────────────
  const maxCompletedFloor = completedIds.size > 0
    ? Math.max(...[...completedIds].map(id => map.nodes[id]?.floor ?? 0))
    : -1

  // ── Nodes ──────────────────────────────────────────────────────────────────
  const nodeEls = Object.values(map.nodes).map(node => {
    const { x, y }    = positions[node.id]
    const isCompleted = completedIds.has(node.id)
    const isCurrent   = node.id === currentId
    const isReachable = reachableIds.has(node.id)
    const isPastFloor = !isCompleted && !isCurrent && !isReachable && node.floor <= maxCompletedFloor

    const strokeW = 1.5
    const textCol = '#28284a'

    const icon =
      node.type === 'start'          ? '★' :
      node.type === 'boss'           ? '♦' :
      node.type === 'pokemon-center' ? '✚' :
      node.type === 'shop'           ? '$' : '?'

    const isTrainer    = node.type === 'trainer'
    const clickable    = isReachable
    const spriteFilter = isCompleted ? 'brightness(0.6) sepia(1) hue-rotate(190deg) saturate(5)'
                       : isPastFloor ? 'brightness(0.2)'
                       : undefined

    return (
      <g
        key={node.id}
        onClick={() => clickable && onNodeClick(node)}
        onMouseMove={e => setTooltip({ node, x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltip(null)}
        style={{ cursor: clickable ? 'pointer' : 'default' }}
      >
        {/* Invisible hit area + state ring */}
        <circle cx={x} cy={y} r={R} fill="transparent" stroke="transparent" strokeWidth={strokeW} />

        <g style={{ filter: spriteFilter }}>
          {isTrainer
            ? <TrainerIcon x={x} y={y} sprite={node.trainerSprite ?? 'Montañero_NB.png'} />
            : node.type === 'wild' || node.type === 'wild_plus_mt'
            ? (
              <image
                href={node.type === 'wild_plus_mt' ? '/sprites/others/grassmt.png' : '/sprites/others/grass.png'}
                x={x - R * 1.5} y={y - R * 1.5}
                width={R * 3} height={R * 3}
                style={{ pointerEvents: 'none', imageRendering: 'pixelated' }}
              />
            )
            : node.type === 'pokemon-center'
            ? (
              <image
                href="/sprites/others/pokecenter.png"
                x={x - R * 1.5} y={y - R * 1.5}
                width={R * 3} height={R * 3}
                style={{ pointerEvents: 'none', imageRendering: 'pixelated' }}
              />
            )
            : node.type === 'shop'
            ? (
              <image
                href="/sprites/others/pokeshop.png"
                x={x - R * 1.5} y={y - R * 1.5}
                width={R * 3} height={R * 3}
                style={{ pointerEvents: 'none', imageRendering: 'pixelated' }}
              />
            )
            : node.type === 'start'
            ? (
              <image
                href="/sprites/others/pokeball.png"
                x={x - R * 1.5} y={y - R * 1.5}
                width={R * 3} height={R * 3}
                style={{ pointerEvents: 'none', imageRendering: 'pixelated' }}
              />
            )
            : node.type === 'boss'
            ? (
              <image
                href="/sprites/others/pokegym.png"
                x={x - R * 1.5} y={y - R * 1.5}
                width={R * 3} height={R * 3}
                style={{ pointerEvents: 'none', imageRendering: 'pixelated' }}
              />
            )
            : node.type === 'random'
            ? (
              <image
                href="/sprites/others/random.png"
                x={x - R * 1.5} y={y - R * 1.5}
                width={R * 3} height={R * 3}
                style={{ pointerEvents: 'none', imageRendering: 'pixelated' }}
              />
            )
            : (
              <text
                x={x} y={y + 5}
                textAnchor="middle"
                fontSize={15}
                fill={textCol}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >{icon}</text>
            )
          }
        </g>
      </g>
    )
  })

  return (
    <div className={styles.container} ref={containerRef}>
      <svg width={W} height={canvasH}>
        {edges}
        {nodeEls}
      </svg>
      {tooltip && (() => {
        const { title, reward } = tooltipContent(tooltip.node)
        return (
          <div
            className={styles.tooltip}
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className={styles.tooltipTitle}>{title}</p>
            {reward && <p className={styles.tooltipReward}>{reward}</p>}
          </div>
        )
      })()}
    </div>
  )
}
