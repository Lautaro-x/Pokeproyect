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
import { generateMap, wildLevel, findGymScene, buildFinalBossScenes } from './history/mapGenerator'
import { incrementHallFame } from '../game/utils/pokedex'
import { generateEnemyTeam } from './history/enemyGenerator'
import { applyEvolution, evolveIfReady } from '../game/utils/evolution'
import type { EvolutionEvent, EvolveResult } from '../game/utils/evolution'
import { unlockNextHistoriaRegion } from '../game/utils/unlockedModes'
import { TeamFullModal } from '../components/TeamFullModal'
import { EvolutionModal } from '../components/EvolutionModal'
import { GameProvider, useGame, getEvolutionFamilyIds } from '../context/GameContext'
import { PokemonInstance } from '../game/entities/PokemonInstance'
import type { Item } from '../game/entities/PokemonInstance'
import { ALL_ITEMS } from '../game/data/items'
import type { ConsumableStack } from '../game/data/items'
import { officialArtwork } from '../game/utils/spriteUrl'
import type { MapData, MapNode } from './history/mapGenerator'
import type { GamePhase } from './GameLayout'
import type { Professor } from './test-env/HistoryStarts'
import type { SceneData } from '../game/utils/sceneTypes'
import type { PokemonData } from '../types'
import allPokemon    from '../assets/pokemon.json'
import professorsData from '../assets/professors.json'
import { ALL_SCENES as scenesData } from '../assets/scenes/index'

const DB = allPokemon as PokemonData[]


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
interface LocationState { region: string; gen: number; mapNumber?: number; team?: PokemonInstance[] }

// ── View state ────────────────────────────────────────────────────────────────
type View      = 'map' | 'history-starts' | 'combat' | 'capture' | 'mt-choice' | 'gym' | 'pokemon-center' | 'shop' | 'random' | 'story' | 'final-boss'
type EventType = 'wild' | 'wild_plus_mt' | 'trainer' | null

function HistoryScreenInner({ save }: { save: LoadedSave | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { region: locRegion = 'kanto', gen: locGen = 1, mapNumber: locMapNumber = 1 } = (location.state as LocationState | null) ?? {}
  const region = save?.region ?? locRegion
  const gen    = save?.gen    ?? locGen

  // ── Shared game state from context ────────────────────────────────────────
  const {
    playerTeam, backpack, consumables, money,
    setPlayerTeam, requestAddPokemon,
    reorderTeam, applyItemDrop, applyConsumableDrop, unequipToBackpack,
    addConsumable, addMoney, applyGifts,
    registerCatch,
  } = useGame()

  const [megaQueue,   setMegaQueue]   = useState<{ teamIdx: number; choices: PokemonData[] }[]>([])
  const [branchQueue, setBranchQueue] = useState<{ teamIdx: number; choices: PokemonData[] }[]>([])

  const handleBranchComplete = useCallback((chosenData: PokemonData) => {
    const entry = branchQueue[0]
    if (!entry) return
    const p = playerTeam[entry.teamIdx]
    if (!p) return

    const event   = applyEvolution(p, chosenData, registerCatch)
    const further = evolveIfReady(p, registerCatch)
    const newEvents: EvolutionEvent[] = [event, ...further.events]

    setPlayerTeam(prev => [...prev])
    setEvolutionQueue(prev => [...prev, ...newEvents])
    setBranchQueue(prev => {
      const rest = prev.slice(1)
      return further.branch
        ? [{ teamIdx: entry.teamIdx, choices: further.branch }, ...rest]
        : rest
    })
  }, [branchQueue, playerTeam, setPlayerTeam])

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
    registerCatch(chosenData.id, mega.shiny)
    setPlayerTeam(prev => { const n = [...prev]; n[entry.teamIdx] = mega; return n })
    setMegaQueue(prev => prev.slice(1))
  }

  // ── Map state (restored from save if resuming) ───────────────────────────
  const [mapNumber,    setMapNumber]    = useState(save?.mapNumber    ?? locMapNumber)
  const [mapData,      setMapData]      = useState<MapData>           (save?.mapData      ?? generateMap(save?.mapNumber ?? locMapNumber, region))
  const [completedIds, setCompletedIds] = useState<Set<string>>       (save?.completedIds ?? new Set())
  const [currentId,    setCurrentId]    = useState<string | null>     (save?.currentId    ?? null)
  const [view,         setView]         = useState<View>('map')
  const [activeNodeId,  setActiveNodeId]  = useState<string | null>(null)
  const [randomScene,      setRandomScene]      = useState<SceneData | null>(null)
  const [storyScene,       setStoryScene]       = useState<SceneData | null>(null)
  const [finalBossScenes,  setFinalBossScenes]  = useState<SceneData[]>([])
  const [finalBossIdx,     setFinalBossIdx]     = useState(0)
  const [showHallFame,     setShowHallFame]     = useState(false)
  const [newlyUnlocked,    setNewlyUnlocked]    = useState<string[]>([])
  const [oakMessage,    setOakMessage]    = useState<string | null>(null)

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
    if (evolutionQueue.length === 0 && branchQueue.length === 0 && pendingActionRef.current) {
      const action = pendingActionRef.current
      pendingActionRef.current = null
      action()
    }
  }, [evolutionQueue, branchQueue])

  // ── Shared: level-up team + queue evolutions, then call proceed ───────────
  const applyTeamLevelGain = useCallback((gain: number, proceed: () => void) => {
    const evolutions: EvolutionEvent[] = []
    const branches:   { teamIdx: number; choices: PokemonData[] }[] = []
    const next = [...playerTeam]
    next.forEach((p, idx) => {
      p.setLevel(p.level + gain)
      const result = evolveIfReady(p, registerCatch)
      evolutions.push(...result.events)
      if (result.branch) branches.push({ teamIdx: idx, choices: result.branch })
    })
    setPlayerTeam(next)
    if (evolutions.length > 0 || branches.length > 0) {
      pendingActionRef.current = proceed
      if (evolutions.length > 0) setEvolutionQueue(evolutions)
      if (branches.length > 0) setBranchQueue(prev => [...prev, ...branches])
    } else {
      proceed()
    }
  }, [playerTeam, setPlayerTeam, registerCatch])

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

    const isLastFloor = node.floor === mapData.totalFloors - 1
    if (node.type === 'boss' || (node.type === 'story' && isLastFloor)) {
      setMapNumber(n => n + 1)
      setMapData(generateMap(mapNumber + 1, region))
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
    const proceed = () => {
      if (eventType === 'wild') {
        enemyTeam[0]?.setLevel(enemyTeam[0].level + 1)
        setView('capture')
      } else if (eventType === 'wild_plus_mt') {
        enemyTeam[0]?.setLevel(enemyTeam[0].level + 1)
        setView('mt-choice')
      } else {
        addMoney(150 + Math.floor(Math.random() * 101))
        completeNode()
      }
    }
    applyTeamLevelGain(levelGain, proceed)
  }, [eventType, enemyTeam, addMoney, completeNode, applyTeamLevelGain])

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
    applyTeamLevelGain(2, completeNode)
  }, [completeNode, applyTeamLevelGain])

  const handleFinalBossSceneWin = useCallback(() => {
    const isChampion = finalBossIdx === finalBossScenes.length - 1
    const proceed = () => {
      if (isChampion) {
        const familyIds = [...new Set(playerTeam.flatMap(p => getEvolutionFamilyIds(p.data.id)))]
        incrementHallFame(familyIds)
        const unlocked = unlockNextHistoriaRegion(region)
        clearSave('historia')
        setNewlyUnlocked(unlocked)
        setShowHallFame(true)
      } else {
        setFinalBossIdx(prev => prev + 1)
      }
    }
    applyTeamLevelGain(2, proceed)
  }, [finalBossIdx, finalBossScenes, playerTeam, applyTeamLevelGain, region])

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
    } else if (node.type === 'final-boss') {
      const scenes = buildFinalBossScenes(region, scenesData)
      setFinalBossScenes(scenes)
      setFinalBossIdx(0)
      setView('final-boss')
    } else if (node.type === 'random') {
      const pool = scenesData.filter(s => s.scene_id.startsWith('random_event_'))
      if (pool.length > 0) {
        setRandomScene(pool[Math.floor(Math.random() * pool.length)])
        setView('random')
      } else {
        completeNode()
      }
    } else if (node.type === 'story') {
      const scene = scenesData.find(s => s.scene_id === node.storySceneId)
      if (scene) {
        setStoryScene(scene)
        setView('story')
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
    const result = applyConsumableDrop(dragJson, toIdx)
    if (result === 'rejected') {
      setOakMessage('Cada cosa en su debido momento')
      return
    }
    if (result) {
      const teamIdx = result.teamIdx
      const evoResult = evolveIfReady(result.pokemon, registerCatch)
      if (evoResult.events.length > 0) setEvolutionQueue(prev => [...prev, ...evoResult.events])
      if (evoResult.branch) setBranchQueue(prev => [...prev, { teamIdx, choices: evoResult.branch! }])
    }
  }

  // ── Derived: boss scene & professor ──────────────────────────────────────
  const bossScene = useMemo(() =>
    findGymScene(scenesData, region, mapNumber),
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
            onBack={() => navigate('/')}
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

          {view === 'story' && storyScene && activeNodeId && (
            <StoryScene
              key={storyScene.scene_id + mapNumber}
              scene={storyScene}
              db={DB}
              baseLevel={wildLevel(mapData.nodes[activeNodeId]?.floor ?? 0, mapNumber)}
              gen={gen}
              onDone={handleGymWin}
              onLose={handleCombatLose}
            />
          )}

          {view === 'final-boss' && finalBossScenes[finalBossIdx] && (
            <StoryScene
              key={`final-boss-${finalBossIdx}`}
              scene={finalBossScenes[finalBossIdx]}
              db={DB}
              baseLevel={wildLevel(mapData.totalFloors - 1, mapNumber)}
              gen={gen}
              onDone={handleFinalBossSceneWin}
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

      {evolutionQueue.length === 0 && branchQueue[0] && (
        <EvolutionModal
          currentData={playerTeam[branchQueue[0].teamIdx]?.data ?? branchQueue[0].choices[0]}
          choices={branchQueue[0].choices}
          onComplete={handleBranchComplete}
        />
      )}

      {showHallFame && (
        <div className={styles.hallFameOverlay}>
          <div className={styles.hallFamePanel}>
            <p className={styles.hallFameStars}>★ ★ ★</p>
            <p className={styles.hallFameTitle}>¡Enhorabuena!</p>
            <p className={styles.hallFameText}>
              Te has pasado la historia de {regionLabel}
            </p>
            {newlyUnlocked.length > 0 && (
              <div className={styles.hallFameUnlocked}>
                <p className={styles.hallFameUnlockedTitle}>Se han desbloqueado los modos:</p>
                <ul className={styles.hallFameUnlockedList}>
                  {newlyUnlocked.map(label => (
                    <li key={label} className={styles.hallFameUnlockedItem}>{label}</li>
                  ))}
                </ul>
              </div>
            )}
            <button className={styles.hallFameBtn} onClick={() => navigate('/')}>
              Continuar
            </button>
          </div>
        </div>
      )}

      <TeamFullModal />

      {oakMessage && (
        <div className={styles.oakOverlay} onClick={() => setOakMessage(null)}>
          <div className={styles.oakModal} onClick={e => e.stopPropagation()}>
            <svg className={styles.oakCard} viewBox="0 0 60 84" width="60" height="84" fill="none">
              <rect x="2" y="2" width="56" height="80" rx="6" fill="#1a1840" stroke="#5550a0" strokeWidth="1.5"/>
              <rect x="7" y="7" width="46" height="70" rx="4" fill="none" stroke="#2e2a60" strokeWidth="1"/>
              <circle cx="11" cy="13" r="2" fill="#5550a0"/>
              <circle cx="49" cy="13" r="2" fill="#5550a0"/>
              <circle cx="11" cy="71" r="2" fill="#5550a0"/>
              <circle cx="49" cy="71" r="2" fill="#5550a0"/>
            </svg>
            <div className={styles.oakTitle}>Prof. Oak</div>
            <p className={styles.oakText}>{oakMessage}</p>
            <button className={styles.oakBtn} onClick={() => setOakMessage(null)}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  )
}

function reconstructTeam(raw: PokemonInstance[]): PokemonInstance[] {
  return raw.map(plain => {
    const data = DB.find(p => p.id === (plain.data as PokemonData).id)
    if (!data) return null
    const inst = new PokemonInstance(data, plain.level, plain.attackLevel)
    inst.currentHp    = plain.currentHp ?? inst.getMaxHp()
    inst.equippedItem = plain.equippedItem ?? null
    inst.shiny        = plain.shiny ?? false
    return inst
  }).filter((p): p is PokemonInstance => p !== null)
}

export default function HistoryScreen() {
  const location = useLocation()
  const state = (location.state as {
    resume?: boolean
    team?: PokemonInstance[]
    backpack?: Item[]
    consumables?: ConsumableStack[]
  } | null) ?? {}
  const { resume, team: rawTeam, backpack: rawBackpack, consumables: rawConsumables } = state

  const save = useMemo(() => {
    if (resume) return readSave('historia')
    clearSave('historia')
    return null
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const injectedTeam = useMemo(
    () => (rawTeam?.length ? reconstructTeam(rawTeam) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <GameProvider
      initialTeam={save?.team ?? injectedTeam}
      initialBackpack={save?.backpack ?? rawBackpack}
      initialConsumables={save?.consumables ?? rawConsumables}
      initialMoney={save?.money}
    >
      <HistoryScreenInner save={save} />
    </GameProvider>
  )
}
