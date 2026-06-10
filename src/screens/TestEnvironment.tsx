import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './TestEnvironment.module.css'
import { TeamPanel } from './panels/TeamPanel'
import { BackpackPanel } from './panels/BackpackPanel'
import { SynergyPanel } from './panels/SynergyPanel'
import { PokemonSelector } from './test-env/PokemonSelector'
import { ItemSelector } from './test-env/ItemSelector'
import { ShopEvent } from './test-env/ShopEvent'
import { PokemonCenter } from './test-env/PokemonCenter'
import { StoryScene } from './test-env/StoryScene'
import type { SceneData } from './test-env/StoryScene'
import scenesData from '../assets/scenes.json'
import { ScenePicker } from './test-env/ScenePicker'
import { HistoryStarts } from './test-env/HistoryStarts'
import type { Professor } from './test-env/HistoryStarts'
import professorsData from '../assets/professors.json'
import { CombatArea } from './combat/CombatArea'
import { EvolutionModal } from '../components/EvolutionModal'
import { clearPokedex } from '../game/utils/pokedex'
import { REGIONS, isHistoriaUnlocked } from '../game/utils/unlockedModes'
import { TeamFullModal } from '../components/TeamFullModal'
import { GameProvider, useGame } from '../context/GameContext'
import { PokemonInstance } from '../game/entities/PokemonInstance'
import type { GamePhase } from './GameLayout'
import type { PokemonData } from '../types'
import allPokemon from '../assets/pokemon.json'

const DB = allPokemon as PokemonData[]


type GameModeStep = 'mode' | 'historia'

type GameBoxView = 'default' | 'add-pokemon' | 'add-item' | 'shop' | 'pokemon-center' | 'gen-picker' | 'history-starts' | 'story-picker' | 'story' | 'combat'

interface EvolutionEntry {
  teamIdx: number
  choices: PokemonData[]
  isMega?: boolean
}

function TestEnvironmentInner() {
  const navigate = useNavigate()

  // ── Shared game state ─────────────────────────────────────────────────────
  const {
    playerTeam, backpack, consumables, money,
    setPlayerTeam, addPokemon, replacePokemon,
    reorderTeam, applyItemDrop, applyConsumableDrop, unequipToBackpack,
    addEquipable, removeEquipable, addConsumable, deductConsumable, addMoney,
    registerCatch,
  } = useGame()

  const handleItemDrop = (dragJson: string, toTeamIdx: number) => {
    const evo = applyItemDrop(dragJson, toTeamIdx)
    if (evo?.isMega) {
      const choices = evo.pokemon.data.evolutions
        .filter(e => e.trigger === 'mega')
        .map(e => DB.find(p => p.name === e.to_name))
        .filter((d): d is PokemonData => d !== undefined)
      if (choices.length > 0)
        setEvolutionQueue(q => [...q, { teamIdx: evo.teamIdx, choices, isMega: true }])
    }
  }

  // ── Local UI / test state ─────────────────────────────────────────────────
  const [enemyTeam,      setEnemyTeam]      = useState<PokemonInstance[]>([])
  const [showEnemyPanel, setShowEnemyPanel] = useState(false)
  const [gameBoxView,    setGameBoxView]    = useState<GameBoxView>('default')
  const [evolutionQueue, setEvolutionQueue] = useState<EvolutionEntry[]>([])
  const [historyGen,     setHistoryGen]     = useState<number>(1)
  const [selectedScene,  setSelectedScene]  = useState<SceneData | null>(null)

  // ── Game mode launch modal ─────────────────────────────────────────────────
  const [gameModeStep,    setGameModeStep]    = useState<GameModeStep | null>(null)
  const [modalRegion,     setModalRegion]     = useState<typeof REGIONS[number]>(REGIONS[0])
  const [modalMapNumber,  setModalMapNumber]  = useState(1)

  const openGameModeModal = () => { setGameModeStep('mode'); setModalRegion(REGIONS[0]); setModalMapNumber(1) }
  const closeGameModeModal = () => setGameModeStep(null)

  const launchHistoria = () => {
    closeGameModeModal()
    navigate('/history', {
      state: { region: modalRegion.id, gen: modalRegion.gen, mapNumber: modalMapNumber, team: playerTeam, backpack, consumables },
    })
  }

  // ── Combat state ──────────────────────────────────────────────────────────
  const [combatEnemyTeam, setCombatEnemyTeam] = useState<PokemonInstance[]>([])
  const [placements,      setPlacements]      = useState<(number | null)[]>(Array(6).fill(null))
  const [combatPhase,     setCombatPhase]     = useState<GamePhase>('positioning')
  const [gameRound,       setGameRound]       = useState(1)
  const [gameResult,      setGameResult]      = useState<'win' | 'lose' | null>(null)

  const emptySet     = useMemo(() => new Set<number>(), [])
  const placedIndices = useMemo(
    () => new Set(placements.filter((p): p is number => p !== null)),
    [placements]
  )

  // ── Consumable drop: context handles item, screen shows evolution modal ───
  const handleConsumableDrop = (dragJson: string, toTeamIdx: number) => {
    const evo = applyConsumableDrop(dragJson, toTeamIdx)
    if (evo) {
      const choices = evo.pokemon.data.evolutions
        .filter(e => e.trigger !== 'mega')
        .map(e => DB.find(p => p.name === e.to_name))
        .filter((d): d is PokemonData => d !== undefined)
      if (choices.length > 0)
        setEvolutionQueue(q => [...q, { teamIdx: evo.teamIdx, choices }])
    }
  }

  const handleEvolutionComplete = (chosenData: PokemonData) => {
    const entry = evolutionQueue[0]
    if (!entry) return
    const p = playerTeam[entry.teamIdx]
    if (!p) return
    const hpPct  = p.currentHp / p.getMaxHp()
    const result = new PokemonInstance(chosenData, p.level, p.attackLevel)
    result.equippedItem = p.equippedItem
    result.shiny        = p.shiny
    result.currentHp    = Math.max(1, Math.floor(result.getMaxHp() * hpPct))
    if (entry.isMega) result.preMegaData = p.data
    registerCatch(chosenData.id, p.shiny)
    replacePokemon(entry.teamIdx, result)
    setEvolutionQueue(prev => prev.slice(1))
  }

  // ── Enemy team helpers (test-only) ────────────────────────────────────────
  const handleEnemyReorder = (from: number, to: number) =>
    setEnemyTeam(prev => { const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n })

  const handleEnemyItemDrop = (dragJson: string, toTeamIdx: number) => {
    try {
      const drag = JSON.parse(dragJson) as { source: 'backpack'; itemId: string } | { source: 'pokemon'; teamIdx: number }
      if (drag.source === 'backpack') {
        const item = backpack.find(i => i.id === drag.itemId)
        if (!item || !enemyTeam[toTeamIdx]) return
        const displaced = enemyTeam[toTeamIdx].equippedItem
        enemyTeam[toTeamIdx].equippedItem = item
        setEnemyTeam([...enemyTeam])
        removeEquipable(item.id)
        if (displaced) addEquipable(displaced)
      } else if (drag.source === 'pokemon') {
        const fromIdx = drag.teamIdx
        if (fromIdx === toTeamIdx) return
        const tmp = enemyTeam[fromIdx].equippedItem
        enemyTeam[fromIdx].equippedItem = enemyTeam[toTeamIdx].equippedItem
        enemyTeam[toTeamIdx].equippedItem = tmp
        setEnemyTeam([...enemyTeam])
      }
    } catch { /* ignore */ }
  }

  const handleEnemyConsumableDrop = (dragJson: string, _toTeamIdx: number) => {
    try {
      const { itemId } = JSON.parse(dragJson) as { source: string; itemId: string }
      deductConsumable(itemId)
    } catch { /* ignore */ }
  }

  const handleEnemyPokemonDrop = (dragJson: string) => {
    try {
      const { id, level, shiny } = JSON.parse(dragJson) as { id: number; level: number; shiny: boolean }
      if (enemyTeam.length >= 6) return
      const data = DB.find(p => p.id === id)
      if (!data) return
      const instance = new PokemonInstance(data, level)
      instance.shiny = shiny
      setEnemyTeam(prev => [...prev, instance])
    } catch { /* ignore */ }
  }

  const handleEnemyPokemonRemove = (teamIdx: number) =>
    setEnemyTeam(prev => prev.filter((_, i) => i !== teamIdx))

  const handleToggleEnemyPanel = () => {
    setShowEnemyPanel(prev => !prev)
    if (showEnemyPanel) setEnemyTeam([])
  }

  const handleRandomTeams = () => {
    const randomTeam = () => {
      const shuffled = [...DB].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, 6).map(data => new PokemonInstance(data, 50))
    }
    setPlayerTeam(randomTeam())
    if (showEnemyPanel) setEnemyTeam(randomTeam())
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  const handleStartCombat = () => {
    const makeCopy = (p: PokemonInstance) => {
      const c = new PokemonInstance(p.data, p.level, p.attackLevel)
      c.equippedItem = p.equippedItem
      c.shiny = p.shiny
      return c
    }
    setCombatEnemyTeam(enemyTeam.map(makeCopy))
    setPlacements(Array(6).fill(null))
    setCombatPhase('positioning')
    setGameRound(1)
    setGameResult(null)
    setGameBoxView('combat')
  }

  const handlePlace = (slot: number, teamIdx: number) =>
    setPlacements(prev => {
      const next = [...prev]
      const old = next.indexOf(teamIdx)
      if (old !== -1) next[old] = null
      next[slot] = teamIdx
      return next
    })

  const handleUnplace = (slot: number) =>
    setPlacements(prev => { const n = [...prev]; n[slot] = null; return n })

  const handleRoundEnd = () => {
    const allEnemiesDefeated = combatEnemyTeam.every(p => p.currentHp <= 0)
    const allPlayersFainted  = playerTeam.every(p => p.currentHp <= 0)

    if (allEnemiesDefeated) { setGameResult('win');  return }
    if (allPlayersFainted)  { setGameResult('lose'); return }

    setGameRound(prev => prev + 1)
    setCombatEnemyTeam(prev => [...prev].sort((a, b) => b.currentHp - a.currentHp))
    setPlacements(Array(6).fill(null))
    setCombatPhase('positioning')
  }

  const handleExitCombat = () => {
    setGameBoxView('default')
    setGameResult(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.screen}>
      <div className={styles.gameGroup}>

        <div className={styles.leftPanel}>
          <TeamPanel
            team={playerTeam}
            placedIndices={gameBoxView === 'combat' ? placedIndices : emptySet}
            faintedIndices={emptySet}
            locked={gameBoxView === 'combat' && combatPhase === 'fighting'}
            side="player"
            money={money}
            onBack={() => navigate('/')}
            onReorder={reorderTeam}
            onItemDrop={handleItemDrop}
            onConsumableDrop={handleConsumableDrop}
            onPokemonDrop={dragJson => {
              try {
                const { id, level, shiny } = JSON.parse(dragJson) as { id: number; level: number; shiny: boolean }
                const data = DB.find(p => p.id === id)
                if (data) { const inst = new PokemonInstance(data, level); inst.shiny = shiny; addPokemon(inst) }
              } catch { /* ignore */ }
            }}
          />
        </div>

        <div className={styles.gameBox}>
          {gameBoxView === 'default' && (
            <div className={styles.defaultView}>
              <h2 className={styles.sectionTitle}>Entorno de Test</h2>
              <div className={styles.actions}>
                <button className={styles.actionBtn} onClick={() => setGameBoxView('add-pokemon')}>
                  + Añadir Pokémon
                </button>
                <button className={styles.actionBtn} onClick={() => setGameBoxView('add-item')}>
                  + Añadir objeto
                </button>
                <button className={styles.actionBtn} onClick={handleRandomTeams}>
                  ⚄ Equipo aleatorio
                </button>
                <button
                  className={`${styles.actionBtn} ${showEnemyPanel ? styles.actionBtnActive : ''}`}
                  onClick={handleToggleEnemyPanel}
                >
                  {showEnemyPanel ? '− Eliminar equipo rival' : '+ Añadir equipo rival'}
                </button>
                <button className={styles.actionBtn} onClick={() => addMoney(1000)}>
                  + 1000 Pokédólares
                </button>
                <button className={styles.actionBtn} onClick={() => { if (confirm('¿Limpiar Pokédex?')) clearPokedex() }}>
                  × Limpiar Pokédex
                </button>
                <button className={`${styles.actionBtn} ${styles.actionBtnLaunch}`} onClick={openGameModeModal}>
                  ▶ Iniciar modo de juego
                </button>
                <button className={styles.actionBtn} onClick={() => setGameBoxView('story-picker')}>
                  ✦ Historia
                </button>
                <button className={styles.actionBtn} onClick={() => setGameBoxView('gen-picker')}>
                  ★ Historia inicial
                </button>
                <button className={styles.actionBtn} onClick={() => setGameBoxView('pokemon-center')}>
                  ✚ Centro Pokémon
                </button>
                <button className={styles.actionBtn} onClick={() => setGameBoxView('shop')}>
                  ⚑ Iniciar evento de tienda
                </button>
                <button
                  className={styles.actionBtn}
                  disabled={playerTeam.length === 0}
                  onClick={handleStartCombat}
                >
                  ⚔ Iniciar combate
                </button>
              </div>
            </div>
          )}

          {gameBoxView === 'add-item' && (
            <ItemSelector
              onBack={() => setGameBoxView('default')}
              backpack={backpack}
              consumables={consumables}
              onAddEquipable={addEquipable}
              onAddConsumable={addConsumable}
            />
          )}

          {gameBoxView === 'add-pokemon' && (
            <PokemonSelector
              onBack={() => setGameBoxView('default')}
              onPokemonRemove={idx => setPlayerTeam(prev => prev.filter((_, i) => i !== idx))}
              onEnemyPokemonRemove={handleEnemyPokemonRemove}
            />
          )}

          {gameBoxView === 'story-picker' && (
            <ScenePicker
              scenes={scenesData as SceneData[]}
              onSelect={scene => { setSelectedScene(scene); setGameBoxView('story') }}
              onBack={() => setGameBoxView('default')}
            />
          )}

          {gameBoxView === 'story' && selectedScene && (
            <StoryScene
              key={selectedScene.scene_id}
              scene={selectedScene}
              db={DB}
              baseLevel={50}
              onDone={() => setGameBoxView('default')}
            />
          )}

          {gameBoxView === 'pokemon-center' && (
            <PokemonCenter
              onDone={() => setGameBoxView('default')}
              onBack={() => setGameBoxView('default')}
            />
          )}

          {gameBoxView === 'gen-picker' && (
            <div className={styles.defaultView}>
              <h2 className={styles.sectionTitle}>¿Qué generación quieres ver?</h2>
              <div className={styles.actions}>
                {(professorsData as Professor[]).map(prof => (
                  <button
                    key={prof.gen}
                    className={styles.actionBtn}
                    onClick={() => { setHistoryGen(prof.gen); setGameBoxView('history-starts') }}
                  >
                    Gen {prof.gen} — {prof.region}
                  </button>
                ))}
                <button className={styles.actionBtn} onClick={() => setGameBoxView('default')}>
                  ← Volver
                </button>
              </div>
            </div>
          )}

          {gameBoxView === 'history-starts' && (() => {
            const prof = (professorsData as Professor[]).find(p => p.gen === historyGen)!
            const starterData = prof.starters.map(id => DB.find(p => p.id === id)!).filter(Boolean)
            return (
              <HistoryStarts
                key={historyGen}
                professor={prof}
                starters={starterData}
                onDone={() => setGameBoxView('default')}
              />
            )
          })()}

          {gameBoxView === 'shop' && (
            <ShopEvent
              onBack={() => setGameBoxView('default')}
            />
          )}

          {gameBoxView === 'combat' && (
            <>
              <CombatArea
                key={gameRound}
                playerTeam={playerTeam}
                enemyTeam={combatEnemyTeam}
                placements={placements}
                phase={combatPhase}
                gameRound={gameRound}
                onPlace={handlePlace}
                onUnplace={handleUnplace}
                onStart={() => setCombatPhase('fighting')}
                onRoundEnd={handleRoundEnd}
              />
              {gameResult && (
                <div className={styles.resultOverlay}>
                  <span className={styles.resultLabel}>
                    {gameResult === 'win' ? '¡Victoria!' : '¡Derrota!'}
                  </span>
                  <button className={styles.resultBtn} onClick={handleExitCombat}>
                    Volver
                  </button>
                </div>
              )}
            </>
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
            <SynergyPanel playerTeam={playerTeam} enemyTeam={enemyTeam} />
          </div>
        </div>

        {showEnemyPanel && gameBoxView !== 'combat' && (
          <div className={styles.enemyPanel}>
            <TeamPanel
              team={enemyTeam}
              placedIndices={emptySet}
              faintedIndices={emptySet}
              locked={false}
              side="enemy"
              onReorder={handleEnemyReorder}
              onItemDrop={handleEnemyItemDrop}
              onConsumableDrop={handleEnemyConsumableDrop}
              onPokemonDrop={handleEnemyPokemonDrop}
            />
          </div>
        )}

      </div>

      {evolutionQueue[0] && (
        <EvolutionModal
          currentData={playerTeam[evolutionQueue[0].teamIdx]?.data ?? evolutionQueue[0].choices[0]}
          choices={evolutionQueue[0].choices}
          onComplete={handleEvolutionComplete}
        />
      )}

      <TeamFullModal />

      {/* ── Game mode launch modal ── */}
      {gameModeStep !== null && (
        <div className={styles.gmOverlay} onClick={closeGameModeModal}>
          <div className={styles.gmModal} onClick={e => e.stopPropagation()}>

            {gameModeStep === 'mode' && (
              <>
                <h3 className={styles.gmTitle}>Iniciar modo de juego</h3>
                <p className={styles.gmSub}>Selecciona un modo</p>
                <div className={styles.gmModes}>
                  <button className={styles.gmModeBtn} onClick={() => setGameModeStep('historia')}>
                    <span className={styles.gmModeName}>Modo Historia</span>
                    <span className={styles.gmModeDesc}>Viaja por las regiones Pokémon</span>
                  </button>
                </div>
                <button className={styles.gmClose} onClick={closeGameModeModal}>Cancelar</button>
              </>
            )}

            {gameModeStep === 'historia' && (
              <>
                <h3 className={styles.gmTitle}>Modo Historia</h3>
                <p className={styles.gmSub}>Elige región y mapa de inicio</p>
                <div className={styles.gmRegionGrid}>
                  {REGIONS.map(r => {
                    const unlocked = isHistoriaUnlocked(r.id)
                    return (
                      <button
                        key={r.id}
                        className={`${styles.gmRegionCard} ${unlocked ? styles.gmRegionUnlocked : styles.gmRegionLocked} ${modalRegion.id === r.id ? styles.gmRegionSelected : ''}`}
                        disabled={!unlocked}
                        onClick={() => setModalRegion(r)}
                      >
                        <span className={styles.gmRegionGen}>{r.genLabel}</span>
                        <span className={styles.gmRegionName}>{r.name}</span>
                        {!unlocked && <span>🔒</span>}
                      </button>
                    )
                  })}
                </div>
                <div className={styles.gmMapRow}>
                  <label className={styles.gmMapLabel}>Mapa de inicio</label>
                  <div className={styles.gmMapControls}>
                    <button className={styles.gmMapBtn} onClick={() => setModalMapNumber(n => Math.max(1, n - 1))}>−</button>
                    <span className={styles.gmMapNum}>{modalMapNumber}</span>
                    <button className={styles.gmMapBtn} onClick={() => setModalMapNumber(n => n + 1)}>+</button>
                  </div>
                </div>
                <div className={styles.gmActions}>
                  <button className={styles.gmClose} onClick={() => setGameModeStep('mode')}>← Atrás</button>
                  <button className={styles.gmLaunch} onClick={launchHistoria} disabled={playerTeam.length === 0}>
                    {playerTeam.length === 0 ? 'Sin equipo' : '▶ Iniciar'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

export default function TestEnvironment() {
  return (
    <GameProvider>
      <TestEnvironmentInner />
    </GameProvider>
  )
}
