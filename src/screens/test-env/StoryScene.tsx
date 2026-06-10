import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import styles from './StoryScene.module.css'
import { CombatArea } from '../combat/CombatArea'
import { PokemonInstance } from '../../game/entities/PokemonInstance'
import { ALL_ITEMS } from '../../game/data/items'
import { useGame } from '../../context/GameContext'
import type { GamePhase } from '../GameLayout'
import type { PokemonData } from '../../types'
import type { Gift } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Actor        { id: string | number; name: string; sprite: string }
export interface DialogLine   { actor_id: string | number; text: string }
export interface ScenePokemon { id: number; item: string | null; is_shiny: boolean; level: number }

export interface SceneOption {
  text:          string
  next_scene_id: string
  make_combat:   boolean
  receive_gift:  boolean
  conditions?:   { pokedollars?: number }[]
}

export interface SceneData {
  scene_id:     string
  scene_name:   string
  actors:       Actor[]
  dialog_start: DialogLine[]
  dialog_end:   DialogLine[]
  options?:     SceneOption[]
  next_scene?:  Record<string, DialogLine[]>
  is_combat:    boolean
  is_gift:      boolean
  pokemons:     ScenePokemon[]
  gift:         Gift[] | null
}

interface Props {
  scene:          SceneData
  db:             PokemonData[]
  baseLevel:      number
  gen?:           number
  onDone:         () => void
  onLose?:        () => void
  withSynergies?: boolean
}

type Phase = 'dialog_start' | 'options' | 'next_scene' | 'combat' | 'dialog_end'

// ── Component ─────────────────────────────────────────────────────────────────

export function StoryScene({ scene, db, baseLevel, gen, onDone, onLose, withSynergies = true }: Props) {
  const { playerTeam, setPlayerTeam, applyGifts, money } = useGame()

  const initialPhase: Phase =
    scene.dialog_start.length > 0 ? 'dialog_start' :
    scene.options?.length          ? 'options'       :
    scene.is_combat                ? 'combat'        :
                                     'dialog_end'

  const [phase,       setPhase]       = useState<Phase>(initialPhase)
  const [dialogIndex, setDialogIndex] = useState(0)

  // Ref so finalize/proceedAfterOption can read the chosen option synchronously
  const selectedOptionRef = useRef<SceneOption | null>(null)

  // ── Combat state ──────────────────────────────────────────────────────────
  const [placements,      setPlacements]      = useState<(number | null)[]>(Array(6).fill(null))
  const [combatPhase,     setCombatPhase]     = useState<GamePhase>('positioning')
  const [gameRound,       setGameRound]       = useState(1)
  const [combatResult,    setCombatResult]    = useState<'win' | 'lose' | null>(null)
  const [combatEnemyTeam, setCombatEnemyTeam] = useState<PokemonInstance[]>(() =>
    scene.pokemons
      .map(sp => {
        const data = db.find(p => p.id === sp.id)
        if (!data) return null
        const inst = new PokemonInstance(data, baseLevel + sp.level)
        inst.shiny = sp.is_shiny
        if (sp.item) inst.equippedItem = ALL_ITEMS.find(i => i.id === sp.item) ?? null
        return inst
      })
      .filter((p): p is PokemonInstance => p !== null)
  )

  const placedIndices = useMemo(
    () => new Set(placements.filter((p): p is number => p !== null)),
    [placements]
  )

  // ── Flow helpers ──────────────────────────────────────────────────────────

  const finalize = useCallback(() => {
    const opt = selectedOptionRef.current
    const shouldGift = scene.is_gift && scene.gift?.length && (
      !scene.options?.length || opt?.receive_gift
    )
    if (shouldGift) applyGifts(scene.gift!, { level: baseLevel, gen })
    onDone()
  }, [scene, applyGifts, onDone, baseLevel, gen])

  const proceedAfterOption = useCallback((opt: SceneOption) => {
    if (opt.make_combat) {
      setPhase('combat')
    } else if (scene.dialog_end.length > 0) {
      setDialogIndex(0); setPhase('dialog_end')
    } else {
      finalize()
    }
  }, [scene, finalize])

  const transitionAfterDialog = useCallback((completedPhase: Phase) => {
    if (completedPhase === 'dialog_start') {
      if (scene.options?.length) {
        setPhase('options')
      } else if (scene.is_combat) {
        setPhase('combat')
      } else if (scene.dialog_end.length > 0) {
        setDialogIndex(0); setPhase('dialog_end')
      } else {
        finalize()
      }
    } else if (completedPhase === 'next_scene') {
      proceedAfterOption(selectedOptionRef.current!)
    } else if (completedPhase === 'dialog_end') {
      finalize()
    }
  }, [scene, finalize, proceedAfterOption])

  useEffect(() => {
    if (phase === 'dialog_end' && scene.dialog_end.length === 0) finalize()
  }, [phase, scene.dialog_end.length, finalize])

  const handleOptionSelect = useCallback((opt: SceneOption) => {
    selectedOptionRef.current = opt
    const nextLines = scene.next_scene?.[opt.next_scene_id]
    if (nextLines?.length) {
      setDialogIndex(0)
      setPhase('next_scene')
    } else {
      proceedAfterOption(opt)
    }
  }, [scene, proceedAfterOption])

  // ── Dialog array for current phase ───────────────────────────────────────
  const dialogArr: DialogLine[] =
    phase === 'dialog_start' ? scene.dialog_start :
    phase === 'next_scene'   ? (scene.next_scene?.[selectedOptionRef.current?.next_scene_id ?? ''] ?? []) :
                               scene.dialog_end

  const advance = () => {
    if (dialogIndex + 1 < dialogArr.length) {
      setDialogIndex(i => i + 1)
    } else {
      transitionAfterDialog(phase)
    }
  }

  // ── Combat handlers ───────────────────────────────────────────────────────
  const handlePlace = (slot: number, teamIdx: number) =>
    setPlacements(prev => {
      const next = [...prev]
      const old  = next.indexOf(teamIdx)
      if (old !== -1) next[old] = null
      next[slot] = teamIdx
      return next
    })

  const handleUnplace = (slot: number) =>
    setPlacements(prev => { const n = [...prev]; n[slot] = null; return n })

  const handleRoundEnd = () => {
    const allEnemiesDefeated = combatEnemyTeam.every(p => p.currentHp <= 0)
    const allPlayersFainted  = playerTeam.every(p => p.currentHp <= 0)

    if (allEnemiesDefeated) { setCombatResult('win');  return }
    if (allPlayersFainted)  { setCombatResult('lose'); return }

    setGameRound(r => r + 1)
    setCombatEnemyTeam(prev => [...prev].sort((a, b) => b.currentHp - a.currentHp))
    setPlacements(Array(6).fill(null))
    setCombatPhase('positioning')
  }

  const handleLevelUp = useCallback(() => {
    setPlayerTeam(prev => [...prev])
  }, [setPlayerTeam])

  const handleCombatContinue = () => {
    if (combatResult === 'lose') { (onLose ?? onDone)(); return }
    if (scene.dialog_end.length > 0) {
      setDialogIndex(0); setPhase('dialog_end')
    } else {
      finalize()
    }
  }

  // ── Option condition check ────────────────────────────────────────────────
  const isOptionDisabled = (opt: SceneOption) =>
    opt.conditions?.some(c => c.pokedollars !== undefined && money < c.pokedollars) ?? false

  // ── Current dialog line (shared by dialog_start / next_scene / dialog_end) ─
  const currentLine   = dialogArr[dialogIndex]
  const speakingId    = currentLine?.actor_id
  const speakingActor = scene.actors.find(a => String(a.id) === String(speakingId))
  const isDim = (actor: Actor) =>
    speakingActor !== undefined && String(actor.id) !== String(speakingId)

  // ── Actor area renderer (shared) ──────────────────────────────────────────
  const actorCount = scene.actors.length
  const dimInDialog = phase !== 'options'

  const renderActors = () => (
    <div className={styles.actorArea}>
      {actorCount === 1 && (
        <img
          src={`/sprites/historias/${scene.actors[0].sprite}`}
          alt={scene.actors[0].name}
          className={`${styles.actorCenter} ${dimInDialog && isDim(scene.actors[0]) ? styles.actorDim : ''}`}
          draggable={false}
        />
      )}
      {actorCount === 2 && (
        <>
          <img
            src={`/sprites/historias/${scene.actors[1].sprite}`}
            alt={scene.actors[1].name}
            className={`${styles.actorSide} ${styles.actorLeft} ${dimInDialog && isDim(scene.actors[1]) ? styles.actorDim : ''}`}
            draggable={false}
          />
          <img
            src={`/sprites/historias/${scene.actors[0].sprite}`}
            alt={scene.actors[0].name}
            className={`${styles.actorSide} ${styles.actorRight} ${dimInDialog && isDim(scene.actors[0]) ? styles.actorDim : ''}`}
            draggable={false}
          />
        </>
      )}
      {actorCount >= 3 && (
        <>
          <img
            src={`/sprites/historias/${scene.actors[0].sprite}`}
            alt={scene.actors[0].name}
            className={`${styles.actorTriple} ${styles.actorTripleLeft} ${dimInDialog && isDim(scene.actors[0]) ? styles.actorDim : ''}`}
            draggable={false}
          />
          <img
            src={`/sprites/historias/${scene.actors[1].sprite}`}
            alt={scene.actors[1].name}
            className={`${styles.actorTriple} ${styles.actorTripleCenter} ${dimInDialog && isDim(scene.actors[1]) ? styles.actorDim : ''}`}
            draggable={false}
          />
          <img
            src={`/sprites/historias/${scene.actors[2].sprite}`}
            alt={scene.actors[2].name}
            className={`${styles.actorTriple} ${styles.actorTripleRight} ${dimInDialog && isDim(scene.actors[2]) ? styles.actorDim : ''}`}
            draggable={false}
          />
        </>
      )}
    </div>
  )

  // ── Render: combat ────────────────────────────────────────────────────────
  if (phase === 'combat') {
    return (
      <div className={styles.scene}>
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
          onLevelUp={handleLevelUp}
          withSynergies={withSynergies}
        />
        {combatResult && (
          <div className={styles.resultOverlay}>
            <span className={styles.resultLabel}>
              {combatResult === 'win' ? '¡Victoria!' : '¡Derrota!'}
            </span>
            <button className={styles.resultBtn} onClick={handleCombatContinue}>
              Continuar
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Render: options ───────────────────────────────────────────────────────
  if (phase === 'options') {
    return (
      <div className={styles.scene}>
        {renderActors()}
        <div className={styles.dialogBox}>
          <div className={styles.optionsList}>
            {scene.options!.map((opt, i) => {
              const disabled = isOptionDisabled(opt)
              return (
                <button
                  key={i}
                  className={`${styles.optionBtn} ${disabled ? styles.optionBtnDisabled : ''}`}
                  disabled={disabled}
                  onClick={() => handleOptionSelect(opt)}
                >
                  <span>{opt.text}</span>
                  {disabled && <span className={styles.optionHint}>Fondos insuficientes</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: dialog (dialog_start / next_scene / dialog_end) ──────────────
  return (
    <div className={styles.scene}>
      {renderActors()}
      <div className={styles.dialogBox}>
        {speakingActor && (
          <span className={styles.actorName}>{speakingActor.name}</span>
        )}
        <p className={styles.dialogText}>{currentLine?.text}</p>
        <button className={styles.nextBtn} onClick={advance}>
          Siguiente →
        </button>
      </div>
    </div>
  )
}
