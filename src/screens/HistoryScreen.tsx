import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { writeSave, clearSave, readSave } from '../game/utils/saveGame'
import type { LoadedSave } from '../game/utils/saveGame'
import styles from './HistoryScreen.module.css'
import { TeamPanel } from './panels/TeamPanel'
import { BackpackPanel } from './panels/BackpackPanel'
import { SynergyPanel } from './panels/SynergyPanel'
import { NodeMap } from './history/NodeMap'
import { WildCombat } from './history/WildCombat'
import { HistoryStarts } from './test-env/HistoryStarts'
import { PokemonCenter } from './test-env/PokemonCenter'
import { ShopEvent }    from './test-env/ShopEvent'
import { StoryScene } from './test-env/StoryScene'
import { generateMap, wildLevel } from './history/mapGenerator'
import { TeamFullModal } from '../components/TeamFullModal'
import { EvolutionModal } from '../components/EvolutionModal'
import { GameProvider, useGame } from '../context/GameContext'
import { PokemonInstance } from '../game/entities/PokemonInstance'
import { ALL_ITEMS } from '../game/data/items'
import { officialArtwork } from '../game/utils/spriteUrl'
import type { MapData, MapNode } from './history/mapGenerator'
import type { GamePhase } from './GameLayout'
import type { Professor } from './test-env/HistoryStarts'
import type { SceneData } from './test-env/StoryScene'
import type { PokemonData, RegionPresence } from '../types'
import allPokemon    from '../assets/pokemon.json'
import professorsData from '../assets/professors.json'
import scenesData    from '../assets/scenes.json'

const DB = allPokemon as PokemonData[]

interface EvolutionEvent { fromName: string; fromId: number; toName: string; toId: number }

function evolveIfReady(pokemon: PokemonInstance): EvolutionEvent[] {
  const events: EvolutionEvent[] = []
  let evolved = true
  while (evolved) {
    evolved = false
    const evo = pokemon.data.evolutions.find(
      e => e.trigger === 'level' && e.level <= pokemon.level
    )
    if (!evo) break
    const newData = DB.find(p => p.name === evo.to_name)
    if (!newData) break
    const fromName = pokemon.data.name
    const fromId   = pokemon.data.id
    const wasFainted = pokemon.currentHp === 0
    const hpPct = pokemon.currentHp / pokemon.getMaxHp()
    pokemon.data = newData as PokemonData
    pokemon.currentHp = wasFainted ? 0 : Math.max(1, Math.floor(pokemon.getMaxHp() * hpPct))
    events.push({ fromName, fromId, toName: newData.name, toId: newData.id })
    evolved = true
  }
  return events
}

function EvolutionOverlay({ event, onDismiss }: { event: EvolutionEvent; onDismiss: () => void }) {
  const [phase, setPhase] = useState<'flash' | 'reveal'>('flash')
  useEffect(() => {
    setPhase('flash')
    const t = setTimeout(() => setPhase('reveal'), 1800)
    return () => clearTimeout(t)
  }, [event.fromId])
  return (
    <div className={styles.evoOverlay}>
      <p className={styles.evoLabel}>
        {phase === 'flash'
          ? `¡${event.fromName} está evolucionando!`
          : `¡${event.fromName} ha evolucionado!`}
      </p>
      <div className={styles.evoSprites}>
        <img
          className={phase === 'flash' ? styles.evoSpriteFlashing : styles.evoSpriteHidden}
          src={officialArtwork(event.fromId)}
          alt={event.fromName}
        />
        <img
          className={phase === 'reveal' ? styles.evoSpriteVisible : styles.evoSpriteHidden}
          src={officialArtwork(event.toId)}
          alt={event.toName}
        />
      </div>
      {phase === 'reveal' && (
        <>
          <p className={styles.evoNewName}>¡{event.toName}!</p>
          <button className={styles.evoContinueBtn} onClick={onDismiss}>
            Continuar
          </button>
        </>
      )}
    </div>
  )
}

// ── Config per region ─────────────────────────────────────────────────────────
interface LocationState { region: string; gen: number }

// Finds the gym scene for the current map number, falling back to
// the highest available gym if the exact number doesn't exist.
function findGymScene(scenes: SceneData[], region: string, mapNumber: number): SceneData | null {
  for (let n = mapNumber; n >= 1; n--) {
    const scene = scenes.find(s => s.scene_id === `${region}_gym_${n}`)
    if (scene) return scene
  }
  return scenes.find(s => s.scene_id.startsWith(`${region}_gym_`)) ?? null
}

// ── Evolution stage precomputation ───────────────────────────────────────────
// Reverse map: pokémon name → names of pokémon that evolve INTO it (non-mega)
const _parents = new Map<string, string[]>()
for (const p of DB) {
  for (const evo of p.evolutions) {
    if (evo.trigger !== 'mega') {
      const list = _parents.get(evo.to_name) ?? []
      list.push(p.name)
      _parents.set(evo.to_name, list)
    }
  }
}

// Stage depth: 0 = base form, 1 = 2nd stage, 2 = 3rd stage, …
function _computeStage(name: string, visited = new Set<string>()): number {
  if (visited.has(name)) return 0
  const parents = _parents.get(name)
  if (!parents || parents.length === 0) return 0
  visited.add(name)
  return _computeStage(parents[0], visited) + 1
}
const _evoStage = new Map<string, number>()
DB.forEach(p => { _evoStage.set(p.name, _computeStage(p.name)) })

function hasNonMegaEvo(p: PokemonData): boolean {
  return p.evolutions.some(e => e.trigger !== 'mega')
}

// ── Pool builder ──────────────────────────────────────────────────────────────
function pickPool(region: string, mapNumber: number): PokemonData[] {
  const key = region as keyof RegionPresence
  return DB.filter(p => {
    if (p.is_mega || p.is_legendary || p.is_mythical) return false
    if ((p.in_region?.[key] ?? 0) === 0) return false

    const stage = _evoStage.get(p.name) ?? 0

    if (mapNumber === 1) {
      // Only base forms that can still evolve
      return stage === 0 && hasNonMegaEvo(p)
    } else if (mapNumber <= 3) {
      // + 2nd stage (middle or final of 2-chain)
      return (stage === 0 && hasNonMegaEvo(p)) || stage === 1
    } else {
      // + 3rd stage and beyond
      return (stage === 0 && hasNonMegaEvo(p)) || stage >= 1
    }
  })
}

function generateEnemyTeam(
  type: 'wild' | 'wild_plus_mt' | 'trainer',
  region: string,
  floor: number,
  mapNumber: number,
  trainerTypes?: string[],
): PokemonInstance[] {
  const basePool = pickPool(region, mapNumber)

  let pool = basePool
  if (type === 'trainer' && trainerTypes && trainerTypes.length > 0) {
    const filtered = basePool.filter(p => p.types.some(t => trainerTypes.includes(t)))
    if (filtered.length > 0) pool = filtered
  }

  const isWild   = type === 'wild' || type === 'wild_plus_mt'
  const maxCount = isWild ? 1 : (mapNumber === 1 ? 2 : 4)
  const count    = isWild ? 1 : Math.floor(Math.random() * maxCount) + 1

  return Array.from({ length: count }, () => {
    const data = pool[Math.floor(Math.random() * pool.length)]
    const p = new PokemonInstance(data, wildLevel(floor, mapNumber))
    if (isWild && Math.random() < 0.10) p.shiny = true
    return p
  })
}

// ── View state ────────────────────────────────────────────────────────────────
type View      = 'map' | 'history-starts' | 'combat' | 'capture' | 'mt-choice' | 'gym' | 'pokemon-center' | 'shop' | 'random'
type EventType = 'wild' | 'wild_plus_mt' | 'trainer' | null

function HistoryScreenInner({ save }: { save: LoadedSave | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { region: locRegion = 'kanto', gen: locGen = 1 } = (location.state as LocationState | null) ?? {}
  const region = save?.region ?? locRegion
  const gen    = save?.gen    ?? locGen

  // ── Shared game state from context ────────────────────────────────────────
  const {
    playerTeam, backpack, consumables, money,
    setPlayerTeam, requestAddPokemon,
    reorderTeam, applyItemDrop, applyConsumableDrop, unequipToBackpack,
    addConsumable, addMoney, applyGifts,
  } = useGame()

  const [megaQueue, setMegaQueue] = useState<{ teamIdx: number; choices: PokemonData[] }[]>([])

  const handleItemDrop = (dragJson: string, toTeamIdx: number) => {
    const evo = applyItemDrop(dragJson, toTeamIdx)
    if (evo?.isMega) {
      const choices = evo.pokemon.data.evolutions
        .filter(e => e.trigger === 'mega')
        .map(e => DB.find(p => p.name === e.to_name))
        .filter((d): d is PokemonData => d !== undefined)
      if (choices.length > 0)
        setMegaQueue(q => [...q, { teamIdx: evo.teamIdx, choices }])
    }
  }

  const handleMegaComplete = (chosenData: PokemonData) => {
    const entry = megaQueue[0]
    if (!entry) return
    const p = playerTeam[entry.teamIdx]
    if (!p) return
    const hpPct = p.currentHp / p.getMaxHp()
    const mega  = new PokemonInstance(chosenData, p.level, p.attackLevel)
    mega.equippedItem = p.equippedItem
    mega.shiny        = p.shiny
    mega.currentHp    = Math.max(1, Math.floor(mega.getMaxHp() * hpPct))
    mega.preMegaData  = p.data
    setPlayerTeam(prev => { const n = [...prev]; n[entry.teamIdx] = mega; return n })
    setMegaQueue(prev => prev.slice(1))
  }

  // ── Map state (restored from save if resuming) ───────────────────────────
  const [mapNumber,    setMapNumber]    = useState(save?.mapNumber    ?? 1)
  const [mapData,      setMapData]      = useState<MapData>           (save?.mapData      ?? generateMap(1))
  const [completedIds, setCompletedIds] = useState<Set<string>>       (save?.completedIds ?? new Set())
  const [currentId,    setCurrentId]    = useState<string | null>     (save?.currentId    ?? null)
  const [view,         setView]         = useState<View>('map')
  const [activeNodeId,  setActiveNodeId]  = useState<string | null>(null)
  const [randomScene,   setRandomScene]   = useState<SceneData | null>(null)

  // ── Combat event state ────────────────────────────────────────────────────
  const [eventType,     setEventType]     = useState<EventType>(null)
  const [enemyTeam,     setEnemyTeam]     = useState<PokemonInstance[]>([])
  const [trainerSprite, setTrainerSprite] = useState<string | null>(null)

  // ── Combat phase state (lifted so TeamPanel can read it) ──────────────────
  const [combatPhase,      setCombatPhase]      = useState<GamePhase>('positioning')
  const [combatPlacements, setCombatPlacements] = useState<(number | null)[]>(Array(6).fill(null))
  const [gameOver,         setGameOver]         = useState(false)

  // ── Auto-save on every node completion ───────────────────────────────────
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    writeSave('historia', {
      region, gen,
      mapNumber, mapData,
      completedIds: [...completedIds],
      currentId,
      money,
      team:        playerTeam,
      backpack,
      consumables,
    })
  }, [completedIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Evolution queue ───────────────────────────────────────────────────────
  const [evolutionQueue, setEvolutionQueue] = useState<EvolutionEvent[]>([])
  const pendingActionRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (evolutionQueue.length === 0 && pendingActionRef.current) {
      const action = pendingActionRef.current
      pendingActionRef.current = null
      action()
    }
  }, [evolutionQueue])

  const combatPlacedIndices = useMemo(
    () => new Set(combatPlacements.filter((p): p is number => p !== null)),
    [combatPlacements]
  )

  const emptySet = useMemo(() => new Set<number>(), [])

  // ── Derived: reachable nodes ──────────────────────────────────────────────
  const reachableIds = useMemo<Set<string>>(() => {
    if (currentId === null) return new Set([mapData.floors[0][0]])
    const node = mapData.nodes[currentId]
    return new Set(node.nextIds.filter(id => !completedIds.has(id)))
  }, [currentId, completedIds, mapData])

  // ── Complete node ─────────────────────────────────────────────────────────
  const completeNode = useCallback(() => {
    if (!activeNodeId) return
    const node = mapData.nodes[activeNodeId]
    const newCompleted = new Set([...completedIds, activeNodeId])
    setCompletedIds(newCompleted)
    setCurrentId(activeNodeId)

    if (node.type === 'boss') {
      setMapNumber(n => n + 1)
      setMapData(generateMap(mapNumber + 1))
      setCompletedIds(new Set())
      setCurrentId(null)
    }

    setActiveNodeId(null)
    setEnemyTeam([])
    setEventType(null)
    setCombatPlacements(Array(6).fill(null))
    setCombatPhase('positioning')
    setView('map')
  }, [activeNodeId, mapData, completedIds])

  // ── Combat handlers ───────────────────────────────────────────────────────
  const handleCombatPlace = useCallback((slot: number, teamIdx: number) =>
    setCombatPlacements(prev => {
      const next = [...prev]
      const old  = next.indexOf(teamIdx)
      if (old !== -1) next[old] = null
      next[slot] = teamIdx
      return next
    }), [])

  const handleCombatUnplace = useCallback((slot: number) =>
    setCombatPlacements(prev => { const n = [...prev]; n[slot] = null; return n }), [])

  const handleCombatStart = useCallback(() => {
    setCombatPhase('fighting')
  }, [])

  const handleCombatNextRound = useCallback(() => {
    setEnemyTeam(prev => [...prev].sort((a, b) => b.currentHp - a.currentHp))
    setCombatPlacements(Array(6).fill(null))
    setCombatPhase('positioning')
  }, [])

  // ── Post-combat: level up + capture ──────────────────────────────────────
  const handleCombatWin = useCallback(() => {
    const levelGain = eventType === 'trainer' ? 2 : 1

    const evolutions: EvolutionEvent[] = []
    const next = [...playerTeam]
    next.forEach(p => {
      p.setLevel(p.level + levelGain)
      evolutions.push(...evolveIfReady(p))
    })
    setPlayerTeam(next)

    const proceed = () => {
      if (eventType === 'wild') {
        enemyTeam[0]?.setLevel((enemyTeam[0].level) + 1)
        setView('capture')
      } else if (eventType === 'wild_plus_mt') {
        enemyTeam[0]?.setLevel((enemyTeam[0].level) + 1)
        setView('mt-choice')
      } else {
        addMoney(150 + Math.floor(Math.random() * 101))
        completeNode()
      }
    }

    if (evolutions.length > 0) {
      pendingActionRef.current = proceed
      setEvolutionQueue(evolutions)
    } else {
      proceed()
    }
  }, [eventType, playerTeam, enemyTeam, setPlayerTeam, addMoney, completeNode])

  const handleChooseMT = useCallback(() => {
    const mt = ALL_ITEMS.find(i => i.id === 'tm')
    if (mt) addConsumable(mt)
    completeNode()
  }, [addConsumable, completeNode])

  const handleChoosePokemon = useCallback(() => {
    const wild = enemyTeam[0]
    if (!wild) return
    wild.currentHp = wild.getMaxHp()
    requestAddPokemon(wild, completeNode)
  }, [enemyTeam, requestAddPokemon, completeNode])

  const handleCapture = useCallback(() => {
    const wild = enemyTeam[0]
    if (!wild) return
    wild.currentHp = wild.getMaxHp()
    requestAddPokemon(wild, completeNode)
  }, [enemyTeam, requestAddPokemon, completeNode])

  const handleSkipCapture = useCallback(() => {
    completeNode()
  }, [completeNode])

  // ── History starts done: starter + 3 potions + 200₽ ─────────────────────
  const handleHistoryStartsDone = useCallback(() => {
    applyGifts([
      { type: 'pokedollars', quantity: 200 },
      { type: 'item', item_id: 'potion', quantity: 3 },
    ])
    completeNode()
  }, [applyGifts, completeNode])

  const handleGymWin = useCallback(() => {
    const evolutions: EvolutionEvent[] = []
    const next = [...playerTeam]
    next.forEach(p => {
      p.setLevel(p.level + 2)
      evolutions.push(...evolveIfReady(p))
    })
    setPlayerTeam(next)

    if (evolutions.length > 0) {
      pendingActionRef.current = completeNode
      setEvolutionQueue(evolutions)
    } else {
      completeNode()
    }
  }, [playerTeam, setPlayerTeam, completeNode])

  // ── Node click ────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: MapNode) => {
    setActiveNodeId(node.id)

    if (node.type === 'start') {
      setView('history-starts')
    } else if (node.type === 'pokemon-center') {
      setView('pokemon-center')
    } else if (node.type === 'shop') {
      setView('shop')
    } else if (node.type === 'boss') {
      setView('gym')
    } else if (node.type === 'random') {
      const pool = (scenesData as SceneData[]).filter(s => s.scene_id.startsWith('random_event_'))
      if (pool.length > 0) {
        setRandomScene(pool[Math.floor(Math.random() * pool.length)])
        setView('random')
      } else {
        completeNode()
      }
    } else {
      const enemies = generateEnemyTeam(node.type, region, node.floor, mapNumber, node.trainerTypes)
      setEnemyTeam(enemies)
      setTrainerSprite(node.trainerSprite ?? null)
      setEventType(node.type)
      setCombatPlacements(Array(6).fill(null))
      setCombatPhase('positioning')
      setView('combat')
    }
  }, [gen, mapNumber])

  const handleCombatLose = useCallback(() => {
    setGameOver(true)
  }, [])

  // ── Consumable drop: context handles item logic, screen handles evolution ──
  const handleConsumableDrop = (dragJson: string, toIdx: number) => {
    const evo = applyConsumableDrop(dragJson, toIdx)
    if (evo) {
      const evos = evolveIfReady(evo.pokemon)
      if (evos.length > 0) setEvolutionQueue(prev => [...prev, ...evos])
    }
  }

  // ── Derived: boss scene & professor ──────────────────────────────────────
  const bossScene = useMemo(() =>
    findGymScene(scenesData as SceneData[], region, mapNumber),
    [region, mapNumber]
  )

  const prof = useMemo(() =>
    (professorsData as Professor[]).find(p => p.gen === gen) ?? null,
    [gen]
  )

  const starterData = useMemo(() =>
    prof
      ? prof.starters.map(id => DB.find(p => p.id === id)).filter((d): d is PokemonData => d !== undefined)
      : [],
    [prof]
  )

  const regionLabel = region.charAt(0).toUpperCase() + region.slice(1)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.screen}>
      <div className={styles.gameGroup}>

        <div className={styles.leftPanel}>
          <TeamPanel
            team={playerTeam}
            placedIndices={view === 'combat' ? combatPlacedIndices : emptySet}
            faintedIndices={emptySet}
            locked={view === 'combat' && combatPhase === 'fighting'}
            side="player"
            money={money}
            onBack={() => navigate('/historia')}
            onReorder={reorderTeam}
            onItemDrop={handleItemDrop}
            onConsumableDrop={handleConsumableDrop}
            onPokemonDrop={() => {}}
          />
        </div>

        <div className={styles.gameBox}>

          {view === 'map' && (
            <>
              <div className={styles.mapHeader}>
                <span className={styles.mapRegion}>{regionLabel}</span>
                <span className={styles.mapSep}>—</span>
                <span className={styles.mapNumber}>Mapa {mapNumber}</span>
              </div>
              <NodeMap
                map={mapData}
                completedIds={completedIds}
                currentId={currentId}
                reachableIds={reachableIds}
                onNodeClick={handleNodeClick}
              />
            </>
          )}

          {view === 'history-starts' && prof && (
            <HistoryStarts
              key={gen}
              professor={prof}
              starters={starterData}
              onDone={handleHistoryStartsDone}
            />
          )}

          {view === 'combat' && enemyTeam.length > 0 && (
            <WildCombat
              key={activeNodeId}
              enemyTeam={enemyTeam}
              placements={combatPlacements}
              phase={combatPhase}
              onPlace={handleCombatPlace}
              onUnplace={handleCombatUnplace}
              onStart={handleCombatStart}
              onNextRound={handleCombatNextRound}
              onWin={handleCombatWin}
              onLose={handleCombatLose}
            />
          )}

          {view === 'mt-choice' && enemyTeam[0] && (
            <div className={styles.captureView}>
              <p className={styles.captureQuestion}>¡Elige tu recompensa!</p>
              <div className={styles.captureButtons}>
                <button className={styles.btnCapture} onClick={handleChoosePokemon}>
                  <img
                    className={styles.captureArtwork}
                    src={officialArtwork(enemyTeam[0].data.id)}
                    alt={enemyTeam[0].data.name}
                  />
                  <span className={styles.captureName}>{enemyTeam[0].data.name}</span>
                  <span className={styles.captureLevel}>Nv. {enemyTeam[0].level}</span>
                </button>
                <button className={styles.btnSkip} onClick={handleChooseMT}>
                  <img
                    src={`/sprites/items/${ALL_ITEMS.find(i => i.id === 'tm')?.sprite}`}
                    alt="MT"
                    style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
                  />
                  <span className={styles.captureName}>MT</span>
                </button>
              </div>
            </div>
          )}

          {view === 'capture' && enemyTeam[0] && (
            <div className={styles.captureView}>
              <img
                className={styles.captureArtwork}
                src={officialArtwork(enemyTeam[0].data.id)}
                alt={enemyTeam[0].data.name}
              />
              <p className={styles.captureName}>
                {enemyTeam[0].data.name}
                <span className={styles.captureLevel}> Nv. {enemyTeam[0].level}</span>
              </p>
              <p className={styles.captureQuestion}>
                ¿Deseas capturar a <strong>{enemyTeam[0].data.name}</strong>?
              </p>
              <div className={styles.captureButtons}>
                <button className={styles.btnCapture} onClick={handleCapture}>
                  Capturar
                </button>
                <button className={styles.btnSkip} onClick={handleSkipCapture}>
                  Pasar
                </button>
              </div>
            </div>
          )}

          {view === 'pokemon-center' && (
            <PokemonCenter
              onDone={completeNode}
              onBack={completeNode}
            />
          )}

          {view === 'shop' && (
            <ShopEvent
              onBack={completeNode}
            />
          )}

          {view === 'gym' && bossScene && activeNodeId && (
            <StoryScene
              key={bossScene.scene_id + mapNumber}
              scene={bossScene}
              db={DB}
              baseLevel={wildLevel(mapData.nodes[activeNodeId]?.floor ?? 0, mapNumber)}
              gen={gen}
              onDone={handleGymWin}
              onLose={handleCombatLose}
            />
          )}

          {view === 'random' && randomScene && activeNodeId && (
            <StoryScene
              key={randomScene.scene_id + activeNodeId}
              scene={randomScene}
              db={DB}
              baseLevel={wildLevel(mapData.nodes[activeNodeId]?.floor ?? 0, mapNumber)}
              gen={gen}
              onDone={completeNode}
              onLose={handleCombatLose}
            />
          )}

        </div>

        <div className={styles.rightPanel}>
          <div className={styles.rightCard}>
            <BackpackPanel
              equipables={backpack}
              consumables={consumables}
              onItemDrop={unequipToBackpack}
            />
          </div>
          <div className={styles.rightCard}>
            <SynergyPanel
              playerTeam={view === 'combat'
                ? combatPlacements.filter((i): i is number => i !== null).map(i => playerTeam[i]).filter(Boolean)
                : playerTeam}
              enemyTeam={view === 'combat' ? enemyTeam : []}
            />
          </div>
        </div>

      </div>

      {evolutionQueue.length > 0 && (
        <EvolutionOverlay
          event={evolutionQueue[0]}
          onDismiss={() => setEvolutionQueue(prev => prev.slice(1))}
        />
      )}

      {gameOver && (
        <div className={styles.gameOverOverlay}>
          <p className={styles.gameOverTitle}>Has perdido</p>
          <button className={styles.gameOverBtn} onClick={() => navigate('/')}>
            Volver al menú
          </button>
        </div>
      )}

      {megaQueue[0] && (
        <EvolutionModal
          currentData={playerTeam[megaQueue[0].teamIdx]?.data ?? megaQueue[0].choices[0]}
          choices={megaQueue[0].choices}
          onComplete={handleMegaComplete}
        />
      )}

      <TeamFullModal />
    </div>
  )
}

export default function HistoryScreen() {
  const location = useLocation()
  const { resume } = (location.state as { resume?: boolean } | null) ?? {}

  const save = useMemo(() => {
    if (resume) return readSave('historia')
    clearSave('historia')
    return null
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameProvider
      initialTeam={save?.team}
      initialBackpack={save?.backpack}
      initialConsumables={save?.consumables}
      initialMoney={save?.money}
    >
      <HistoryScreenInner save={save} />
    </GameProvider>
  )
}
