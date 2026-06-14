import { useState, useMemo, useCallback, useEffect } from 'react'
import styles from './StoryScene.module.css'
import { CombatArea } from '../combat/CombatArea'
import { PokemonInstance } from '../../game/entities/PokemonInstance'
import { ALL_ITEMS } from '../../game/data/items'
import { useGame } from '../../context/GameContext'
import type { GamePhase } from '../GameLayout'
import type { PokemonData } from '../../types'
import type { SceneData, Actor, DialogLine, CombatNode, ScenePokemon, ExchangeOffer } from '../../game/utils/sceneTypes'

// Re-export types so importers don't need to change
export type { SceneData, Actor, DialogLine }
export type { ScenePokemon } from '../../game/utils/sceneTypes'

interface Props {
  scene:                SceneData
  db:                   PokemonData[]
  baseLevel:            number
  gen?:                 number
  onDone:               () => void
  onLose?:              () => void
  withSynergies?:       boolean
  onEnemyTeamUpdate?:   (team: PokemonInstance[]) => void
}

const REGION_GEN: Record<string, number> = {
  kanto: 1, johto: 2, hoenn: 3, sinnoh: 4,
  teselia: 5, kalos: 6, alola: 7, galar: 8, paldea: 9,
}

function resolveScenePokemon(sp: ScenePokemon, db: PokemonData[], baseLevel: number, gen?: number): PokemonInstance | null {
  let data: PokemonData | undefined

  if (sp.id === 'random') {
    let pool = db.filter(p => !p.is_mega)
    if (sp.generation === 'actual') {
      const effectiveGen = gen ?? Math.ceil(Math.random() * 9)
      pool = pool.filter(p => p.generation === effectiveGen)
    } else if (sp.generation === 'not_actual') {
      if (gen !== undefined) pool = pool.filter(p => p.generation !== gen)
    } else if (sp.generation && REGION_GEN[sp.generation] !== undefined) {
      pool = pool.filter(p => p.generation === REGION_GEN[sp.generation!])
    }

    if (sp.is_legendary || sp.is_mythical) {
      pool = pool.filter(p =>
        (sp.is_legendary && p.is_legendary) ||
        (sp.is_mythical  && p.is_mythical)
      )
    } else {
      pool = pool.filter(p => !p.is_legendary && !p.is_mythical)
    }

    if (pool.length === 0) return null
    data = pool[Math.floor(Math.random() * pool.length)]
  } else {
    data = db.find(p => p.id === sp.id)
  }

  if (!data) return null
  const inst = new PokemonInstance(data, baseLevel + sp.level)
  inst.shiny = sp.is_shiny
  if (sp.item) inst.equippedItem = ALL_ITEMS.find(i => i.id === sp.item) ?? null
  return inst
}

function buildEnemyTeam(node: CombatNode, db: PokemonData[], baseLevel: number, gen?: number): PokemonInstance[] {
  return node.pokemons
    .map(sp => resolveScenePokemon(sp, db, baseLevel, gen))
    .filter((p): p is PokemonInstance => p !== null)
}

export function StoryScene({ scene, db, baseLevel, gen, onDone, onLose, withSynergies = true, onEnemyTeamUpdate }: Props) {
  const { playerTeam, setPlayerTeam, applyGifts, money, registerCatch, addEquipable } = useGame()

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(scene.start)
  const [dialogIndex,   setDialogIndex]   = useState(0)

  // ── Exchange context (resolved once at mount) ──────────────────────────
  // useState lazy-init ensures this runs exactly once; useMemo is not safe
  // for Math.random() because React Strict Mode may call it twice.
  const [teamRandomSlots] = useState<number[]>(() => {
    // Default to full team when team_random_count is unset — covers all members.
    const count   = scene.team_random_count ?? playerTeam.length
    const indices = [...Array(playerTeam.length).keys()]
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return indices.slice(0, Math.min(count, playerTeam.length))
  })

  // resolvedPool starts from pokemon_pool; if pool_from_combat is set it gets
  // overwritten with the enemy team captured on winning that combat node.
  const [resolvedPool, setResolvedPool] = useState<PokemonInstance[]>(() =>
    (scene.pokemon_pool ?? [])
      .map(sp => resolveScenePokemon(sp, db, baseLevel, gen))
      .filter((p): p is PokemonInstance => p !== null)
  )

  // Combat state
  const [placements,      setPlacements]      = useState<(number | null)[]>(Array(6).fill(null))
  const [combatPhase,     setCombatPhase]     = useState<GamePhase>('positioning')
  const [gameRound,       setGameRound]       = useState(1)
  const [combatResult,    setCombatResult]    = useState<'win' | 'lose' | null>(null)
  const [combatEnemyTeam, setCombatEnemyTeam] = useState<PokemonInstance[]>(() => {
    const startNode = scene.start ? scene.nodes[scene.start] : null
    if (startNode?.type === 'combat') return buildEnemyTeam(startNode, db, baseLevel, gen)
    return []
  })

  useEffect(() => {
    onEnemyTeamUpdate?.(combatEnemyTeam)
  }, [combatEnemyTeam, onEnemyTeamUpdate])

  const placedIndices = useMemo(
    () => new Set(placements.filter((p): p is number => p !== null)),
    [placements]
  )

  // Navigate to next node, auto-consuming gift nodes transparently
  const advance = useCallback((nextId: string | null) => {
    if (nextId === null) { onDone(); return }
    let targetId: string | null = nextId

    while (targetId !== null) {
      const node: (typeof scene.nodes)[string] = scene.nodes[targetId]
      if (!node) { onDone(); return }
      if (node.type !== 'gift') break
      if (node.gifts.length > 0) applyGifts(node.gifts, { level: baseLevel, gen })
      targetId = node.next
    }

    if (targetId === null) { onDone(); return }

    const targetNode = scene.nodes[targetId]
    if (targetNode?.type === 'combat') {
      setCombatEnemyTeam(buildEnemyTeam(targetNode, db, baseLevel, gen))
      setPlacements(Array(6).fill(null))
      setCombatPhase('positioning')
      setGameRound(1)
      setCombatResult(null)
    }

    setCurrentNodeId(targetId)
    setDialogIndex(0)
  }, [scene, onDone, applyGifts, baseLevel, gen, db])

  const currentNode = currentNodeId ? scene.nodes[currentNodeId] : null

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
    if (!currentNode || currentNode.type !== 'combat') return
    if (combatResult === 'lose') {
      const loseTarget = currentNode.on_lose
      if (loseTarget) advance(loseTarget)
      else (onLose ?? onDone)()
      return
    }
    if (scene.pool_from_combat && scene.pool_from_combat === currentNodeId) {
      setResolvedPool([...combatEnemyTeam])
    }
    advance(currentNode.on_win)
  }

  // ── Exchange helpers ──────────────────────────────────────────────────────

  const resolveGive = (ref: string | null): PokemonInstance | null => {
    if (!ref) return null
    const m = ref.match(/^team_random_(\d+)$/)
    if (!m) return null
    const idx = teamRandomSlots[Number(m[1])]
    return idx !== undefined ? (playerTeam[idx] ?? null) : null
  }

  const resolveReceive = (ref: string | null): PokemonInstance | null => {
    if (!ref) return null
    const m = ref.match(/^pool_(\d+)$/)
    if (!m) return null
    return resolvedPool[Number(m[1])] ?? null
  }

  const handleExchangeOffer = (offer: ExchangeOffer) => {
    if (offer.give && offer.receive) {
      const giveM = offer.give.match(/^team_random_(\d+)$/)
      if (giveM) {
        const teamIdx = teamRandomSlots[Number(giveM[1])]
        const received = offer.receive === 'pool_random'
          ? resolvedPool[Math.floor(Math.random() * resolvedPool.length)] ?? null
          : resolveReceive(offer.receive)
        if (teamIdx !== undefined && received) {
          const givenItem = playerTeam[teamIdx]?.equippedItem
          if (givenItem) addEquipable(givenItem)
          registerCatch(received.data.id, received.shiny)
          setPlayerTeam(prev => {
            const next = prev.filter((_, i) => i !== teamIdx)
            return [...next, received]
          })
        }
      }
    }
    advance(offer.next)
  }

  // ── Actor helpers ─────────────────────────────────────────────────────────

  const actorCount = scene.actors.length

  const speakingActor = (currentNode?.type === 'dialog' && dialogIndex < currentNode.lines.length)
    ? scene.actors.find(a => String(a.id) === String(currentNode.lines[dialogIndex].actor_id))
    : undefined

  const isDim = (actor: Actor) =>
    speakingActor !== undefined && String(actor.id) !== String(speakingActor.id)

  const renderActors = (dimEnabled = true) => (
    <div className={styles.actorArea}>
      {actorCount === 1 && (
        <img
          src={`/sprites/historias/${scene.actors[0].sprite}`}
          alt={scene.actors[0].name}
          className={`${styles.actorCenter} ${dimEnabled && isDim(scene.actors[0]) ? styles.actorDim : ''}`}
          draggable={false}
        />
      )}
      {actorCount === 2 && (
        <>
          <img
            src={`/sprites/historias/${scene.actors[1].sprite}`}
            alt={scene.actors[1].name}
            className={`${styles.actorSide} ${styles.actorLeft} ${dimEnabled && isDim(scene.actors[1]) ? styles.actorDim : ''}`}
            draggable={false}
          />
          <img
            src={`/sprites/historias/${scene.actors[0].sprite}`}
            alt={scene.actors[0].name}
            className={`${styles.actorSide} ${styles.actorRight} ${dimEnabled && isDim(scene.actors[0]) ? styles.actorDim : ''}`}
            draggable={false}
          />
        </>
      )}
      {actorCount >= 3 && (
        <>
          <img src={`/sprites/historias/${scene.actors[0].sprite}`} alt={scene.actors[0].name}
            className={`${styles.actorTriple} ${styles.actorTripleLeft}   ${dimEnabled && isDim(scene.actors[0]) ? styles.actorDim : ''}`} draggable={false} />
          <img src={`/sprites/historias/${scene.actors[1].sprite}`} alt={scene.actors[1].name}
            className={`${styles.actorTriple} ${styles.actorTripleCenter} ${dimEnabled && isDim(scene.actors[1]) ? styles.actorDim : ''}`} draggable={false} />
          <img src={`/sprites/historias/${scene.actors[2].sprite}`} alt={scene.actors[2].name}
            className={`${styles.actorTriple} ${styles.actorTripleRight}  ${dimEnabled && isDim(scene.actors[2]) ? styles.actorDim : ''}`} draggable={false} />
        </>
      )}
    </div>
  )

  // ── Render: no node (end of scene) ────────────────────────────────────────

  if (!currentNode) return null

  // ── Render: combat ────────────────────────────────────────────────────────

  if (currentNode.type === 'combat') {
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

  if (currentNode.type === 'options') {
    return (
      <div className={styles.scene}>
        {renderActors(false)}
        <div className={styles.dialogBox}>
          <div className={styles.optionsList}>
            {currentNode.options.map((opt, i) => {
              const disabled = (opt.condition?.pokedollars !== undefined && money < opt.condition.pokedollars) ?? false
              return (
                <button
                  key={i}
                  className={`${styles.optionBtn} ${disabled ? styles.optionBtnDisabled : ''}`}
                  disabled={disabled}
                  onClick={() => advance(opt.next)}
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

  // ── Render: exchange ─────────────────────────────────────────────────────

  if (currentNode.type === 'exchange') {
    return (
      <div className={styles.scene}>
        {renderActors(false)}
        <div className={styles.dialogBox}>
          <div className={styles.optionsList}>
            {currentNode.offers.map((offer, i) => {
              const gives    = resolveGive(offer.give)
              const receives = offer.hide_receive ? null : resolveReceive(offer.receive)
              const disabled = offer.give !== null && gives === null
              const btnLabel = offer.hide_receive && gives
                ? `${offer.label} ${gives.data.name}!`
                : offer.label
              return (
                <button
                  key={i}
                  className={`${styles.optionBtn} ${disabled ? styles.optionBtnDisabled : ''}`}
                  disabled={disabled}
                  onClick={() => handleExchangeOffer(offer)}
                >
                  <span>{btnLabel}</span>
                  {!offer.hide_receive && (gives || receives) && (
                    <span className={styles.exchangeDetail}>
                      {gives    && `Das: ${gives.data.name}`}
                      {gives && receives && ' → '}
                      {receives && `Recibes: ${receives.data.name}`}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: dialog ────────────────────────────────────────────────────────

  if (currentNode.type === 'dialog') {
    const line = currentNode.lines[dialogIndex]
    const advanceDialog = () => {
      if (dialogIndex + 1 < currentNode.lines.length) {
        setDialogIndex(i => i + 1)
      } else {
        advance(currentNode.next)
      }
    }

    return (
      <div className={styles.scene}>
        {renderActors(true)}
        <div className={styles.dialogBox}>
          {speakingActor && (
            <span className={styles.actorName}>{speakingActor.name}</span>
          )}
          <p className={styles.dialogText}>{line?.text}</p>
          <button className={styles.nextBtn} onClick={advanceDialog}>
            Siguiente →
          </button>
        </div>
      </div>
    )
  }

  return null
}
