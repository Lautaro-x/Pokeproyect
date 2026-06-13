import { useState, useCallback } from 'react'
import styles from './SceneEditor.module.css'
import { ALL_SCENES } from '../../assets/scenes/index'
import type {
  SceneData, SceneNode, DialogNode, OptionsNode, CombatNode, GiftNode,
  Actor, DialogLine, ScenePokemon, OptionEntry,
} from '../../game/utils/sceneTypes'
import type { Gift, PokemonData } from '../../types'
import allPokemon from '../../assets/pokemon.json'
import { ALL_ITEMS } from '../../game/data/items'
import { GIFT_EFFECTS } from '../../game/utils/giftEffects'

const DB = allPokemon as PokemonData[]

const STORAGE_KEY = 'pk_scene_editor_draft'
const CATEGORIES  = ['gym', 'bad_team', 'final_boss', 'random', 'other']
const CAT_LABELS: Record<string, string> = {
  gym: 'Gimnasio', bad_team: 'Equipo Malo', final_boss: 'Alto Mando', random: 'Evento', other: 'Otro',
}

function emptyScene(): SceneData {
  return {
    scene_id:   `escena_${Date.now()}`,
    scene_name: 'Nueva Escena',
    category:   'other',
    actors:     [],
    start:      null,
    nodes:      {},
  }
}

function emptyNode(type: SceneNode['type']): SceneNode {
  switch (type) {
    case 'dialog':   return { type: 'dialog',   lines: [],   next: null }
    case 'options':  return { type: 'options',  options: [] }
    case 'combat':   return { type: 'combat',   pokemons: [], on_win: null, on_lose: null }
    case 'gift':     return { type: 'gift',     gifts: [],   next: null }
    case 'exchange': return { type: 'exchange', offers: [] }
  }
}

function loadDraft(): SceneData | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') }
  catch { return null }
}

function saveDraft(scene: SceneData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scene))
}

// ── Sub-editors ───────────────────────────────────────────────────────────────

function DialogLineEditor({ lines, onChange }: { lines: DialogLine[]; onChange: (l: DialogLine[]) => void }) {
  const update = (idx: number, field: keyof DialogLine, val: string) => {
    const next = [...lines]
    next[idx] = { ...next[idx], [field]: val }
    onChange(next)
  }
  return (
    <div className={styles.lineList}>
      {lines.map((line, i) => (
        <div key={i} className={styles.lineRow}>
          <input
            className={styles.lineActor}
            placeholder="actor_id"
            value={String(line.actor_id)}
            onChange={e => update(i, 'actor_id', e.target.value)}
          />
          <input
            className={styles.lineText}
            placeholder="Texto del diálogo…"
            value={line.text}
            onChange={e => update(i, 'text', e.target.value)}
          />
          <button className={styles.iconBtn} onClick={() => onChange(lines.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className={styles.addRowBtn} onClick={() => onChange([...lines, { actor_id: '', text: '' }])}>
        + Línea
      </button>
    </div>
  )
}

function NextPicker({ value, nodeIds, label = '→', onChange }: {
  value: string | null; nodeIds: string[]; label?: string; onChange: (v: string | null) => void
}) {
  return (
    <label className={styles.nextPicker}>
      <span className={styles.nextLabel}>{label}</span>
      <select
        className={styles.nextSelect}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">— END —</option>
        {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>
  )
}

function PokemonPickerModal({ onSelect, onClose }: {
  onSelect: (id: number) => void; onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = DB.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    String(p.id).startsWith(search)
  ).slice(0, 80)

  return (
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div className={styles.pickerModal} onClick={e => e.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <input
            className={styles.pickerSearch}
            placeholder="Buscar Pokémon…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <button className={styles.iconBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.pickerList}>
          {filtered.map(p => (
            <button key={p.id} className={styles.pickerItem} onClick={() => onSelect(p.id)}>
              <span className={styles.pickerId}>#{p.id}</span>
              <span className={styles.pickerName}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ItemPickerModal({ onSelect, onClose }: {
  onSelect: (id: string | null) => void; onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = ALL_ITEMS.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div className={styles.pickerModal} onClick={e => e.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <input
            className={styles.pickerSearch}
            placeholder="Buscar ítem…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <button className={styles.iconBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.pickerList}>
          <button className={styles.pickerItem} onClick={() => onSelect(null)}>
            <span className={styles.pickerId}>—</span>
            <span className={styles.pickerName}>Sin ítem</span>
          </button>
          {filtered.map(item => (
            <button key={item.id} className={styles.pickerItem} onClick={() => onSelect(item.id)}>
              <span className={styles.pickerId}>{item.id}</span>
              <span className={styles.pickerName}>{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PokemonRowEditor({ poke, onChange, onDelete }: {
  poke: ScenePokemon; onChange: (p: ScenePokemon) => void; onDelete: () => void
}) {
  const [showPokePicker, setShowPokePicker] = useState(false)
  const [showItemPicker, setShowItemPicker] = useState(false)

  const isRandom  = poke.id === 'random'
  const pokeName  = !isRandom ? (DB.find(p => p.id === poke.id)?.name ?? `#${poke.id}`) : null
  const itemLabel = poke.item ? (ALL_ITEMS.find(i => i.id === poke.item)?.name ?? poke.item) : 'Sin ítem'

  return (
    <>
      <div className={styles.lineRow}>

        {/* random toggle */}
        <label className={styles.inlineCheck}>
          <input type="checkbox" checked={isRandom}
            onChange={e => onChange({ ...poke, id: e.target.checked ? 'random' : 1 })} />
          random
        </label>

        {/* specific picker */}
        {!isRandom && (
          <button
            className={`${styles.pokeName} ${styles.pokeNameBtn}`}
            onClick={() => setShowPokePicker(true)}
          >
            {pokeName ?? 'Elegir…'}
          </button>
        )}

        {/* random filters */}
        {isRandom && (
          <>
            <select className={styles.lineActor}
              value={poke.generation ?? ''}
              onChange={e => onChange({ ...poke, generation: (e.target.value || undefined) as ScenePokemon['generation'] })}
            >
              <option value="">Todas</option>
              <option value="actual">Actual</option>
              <option value="not_actual">Todas menos actual</option>
              <option value="kanto">Kanto</option>
              <option value="johto">Johto</option>
              <option value="hoenn">Hoenn</option>
              <option value="sinnoh">Sinnoh</option>
              <option value="teselia">Teselia</option>
              <option value="kalos">Kalos</option>
              <option value="alola">Alola</option>
              <option value="galar">Galar</option>
              <option value="paldea">Paldea</option>
            </select>
            <label className={styles.inlineCheck}>
              <input type="checkbox" checked={poke.is_legendary ?? false}
                onChange={e => onChange({ ...poke, is_legendary: e.target.checked })} />
              leg.
            </label>
            <label className={styles.inlineCheck}>
              <input type="checkbox" checked={poke.is_mythical ?? false}
                onChange={e => onChange({ ...poke, is_mythical: e.target.checked })} />
              mit.
            </label>
          </>
        )}

        <input
          className={styles.lineActor}
          type="number"
          placeholder="Δlv"
          value={poke.level}
          onChange={e => onChange({ ...poke, level: Number(e.target.value) })}
        />
        <label className={styles.inlineCheck}>
          <input type="checkbox" checked={poke.is_shiny}
            onChange={e => onChange({ ...poke, is_shiny: e.target.checked })} />
          shiny
        </label>
        <button
          className={`${styles.itemPickerBtn} ${poke.item ? styles.itemPickerBtnSet : ''}`}
          onClick={() => setShowItemPicker(true)}
        >
          {itemLabel}
        </button>
        <button className={styles.iconBtn} onClick={onDelete}>×</button>
      </div>

      {showPokePicker && (
        <PokemonPickerModal
          onSelect={id => { onChange({ ...poke, id }); setShowPokePicker(false) }}
          onClose={() => setShowPokePicker(false)}
        />
      )}
      {showItemPicker && (
        <ItemPickerModal
          onSelect={id => { onChange({ ...poke, item: id }); setShowItemPicker(false) }}
          onClose={() => setShowItemPicker(false)}
        />
      )}
    </>
  )
}

function GiftRowEditor({ gift, onChange, onDelete }: {
  gift: Gift; onChange: (g: Gift) => void; onDelete: () => void
}) {
  const [showPokePicker, setShowPokePicker] = useState(false)

  const pokeGift  = gift.type === 'pokemon' ? gift : null
  const isRandom  = pokeGift?.id === 'random'
  const pokeName  = !isRandom && pokeGift
    ? DB.find(p => p.id === pokeGift.id)?.name ?? `#${pokeGift.id}`
    : null

  return (
    <>
      <div className={styles.lineRow}>
        <select
          className={styles.lineActor}
          value={gift.type}
          onChange={e => onChange({ ...gift, type: e.target.value as Gift['type'] })}
        >
          <option value="pokedollars">₽</option>
          <option value="item">item</option>
          <option value="pokemon">pokemon</option>
          <option value="effect">efecto</option>
        </select>

        {gift.type === 'pokedollars' && (
          <input className={styles.lineText} type="number" placeholder="cantidad"
            value={(gift as { quantity?: number }).quantity ?? ''}
            onChange={e => onChange({ ...gift, quantity: Number(e.target.value) } as Gift)} />
        )}

        {gift.type === 'item' && (
          <>
            <input className={styles.lineActor} placeholder="item_id"
              value={(gift as { item_id?: string }).item_id ?? ''}
              onChange={e => onChange({ ...gift, item_id: e.target.value } as Gift)} />
            <input className={styles.lineText} type="number" placeholder="qty"
              value={(gift as { quantity?: number }).quantity ?? 1}
              onChange={e => onChange({ ...gift, quantity: Number(e.target.value) } as Gift)} />
          </>
        )}

        {gift.type === 'pokemon' && (
          <>
            {/* random / specific toggle */}
            <label className={styles.inlineCheck}>
              <input type="checkbox" checked={isRandom}
                onChange={e => onChange({ ...gift, id: e.target.checked ? 'random' : 1 } as Gift)} />
              random
            </label>

            {/* Pokémon picker (only when specific) */}
            {!isRandom && (
              <button
                className={`${styles.itemPickerBtn} ${pokeName ? styles.itemPickerBtnSet : ''}`}
                onClick={() => setShowPokePicker(true)}
              >
                {pokeName ?? 'Elegir Pokémon'}
              </button>
            )}

            {/* Region */}
            <select className={styles.lineActor}
              value={(gift as { generation?: string }).generation ?? ''}
              onChange={e => onChange({ ...gift, generation: e.target.value || undefined } as Gift)}
            >
              <option value="">Todas</option>
              <option value="actual">Actual</option>
              <option value="not_actual">Todas menos actual</option>
              <option value="kanto">Kanto</option>
              <option value="johto">Johto</option>
              <option value="hoenn">Hoenn</option>
              <option value="sinnoh">Sinnoh</option>
              <option value="teselia">Teselia</option>
              <option value="kalos">Kalos</option>
              <option value="alola">Alola</option>
              <option value="galar">Galar</option>
              <option value="paldea">Paldea</option>
            </select>

            <label className={styles.inlineCheck}>
              <input type="checkbox"
                checked={(gift as { is_shiny?: boolean }).is_shiny ?? false}
                onChange={e => onChange({ ...gift, is_shiny: e.target.checked } as Gift)} />
              shiny
            </label>
            <label className={styles.inlineCheck}>
              <input type="checkbox"
                checked={(gift as { is_legendary?: boolean }).is_legendary ?? false}
                onChange={e => onChange({ ...gift, is_legendary: e.target.checked } as Gift)} />
              leg.
            </label>
            <label className={styles.inlineCheck}>
              <input type="checkbox"
                checked={(gift as { is_mythical?: boolean }).is_mythical ?? false}
                onChange={e => onChange({ ...gift, is_mythical: e.target.checked } as Gift)} />
              mit.
            </label>
          </>
        )}

        {gift.type === 'effect' && (
          <select
            className={styles.lineText}
            value={(gift as { effect?: string }).effect ?? ''}
            onChange={e => onChange({ ...gift, effect: e.target.value } as Gift)}
          >
            <option value="">— Selecciona efecto —</option>
            {GIFT_EFFECTS.map(fx => (
              <option key={fx.id} value={fx.id}>{fx.label}</option>
            ))}
          </select>
        )}

        <button className={styles.iconBtn} onClick={onDelete}>×</button>
      </div>

      {showPokePicker && (
        <PokemonPickerModal
          onSelect={id => { onChange({ ...gift, id } as Gift); setShowPokePicker(false) }}
          onClose={() => setShowPokePicker(false)}
        />
      )}
    </>
  )
}

// ── Node card ─────────────────────────────────────────────────────────────────

interface NodeCardProps {
  nodeId:  string
  node:    SceneNode
  nodeIds: string[]
  isStart: boolean
  onUpdate: (node: SceneNode) => void
  onRename: (newId: string) => void
  onDelete: () => void
  onSetStart: () => void
}

function NodeCard({ nodeId, node, nodeIds, isStart, onUpdate, onRename, onDelete, onSetStart }: NodeCardProps) {
  const [collapsed,   setCollapsed]   = useState(false)
  const [editingId,   setEditingId]   = useState(false)
  const [draftId,     setDraftId]     = useState(nodeId)
  const [showPicker,  setShowPicker]  = useState(false)

  const otherIds = nodeIds.filter(id => id !== nodeId)

  const TYPE_COLORS: Record<SceneNode['type'], string> = {
    dialog:  '#4488ff',
    options: '#ff9922',
    combat:  '#ff4444',
    gift:    '#44bb44',
  }

  const commitRename = () => {
    if (draftId && draftId !== nodeId) onRename(draftId)
    setEditingId(false)
  }

  return (
    <div className={`${styles.nodeCard} ${isStart ? styles.nodeCardStart : ''}`}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeTypeBadge} style={{ background: TYPE_COLORS[node.type] }}>
          {node.type}
        </span>

        {editingId ? (
          <input
            className={styles.nodeIdInput}
            value={draftId}
            autoFocus
            onChange={e => setDraftId(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename() }}
          />
        ) : (
          <span className={styles.nodeId} title="Clic para renombrar" onClick={() => { setDraftId(nodeId); setEditingId(true) }}>
            {nodeId}
          </span>
        )}

        {isStart && <span className={styles.startBadge}>START</span>}

        <div className={styles.nodeActions}>
          {!isStart && <button className={styles.iconBtnSm} title="Marcar como inicio" onClick={onSetStart}>⊙</button>}
          <button className={styles.iconBtnSm} onClick={() => setCollapsed(c => !c)}>{collapsed ? '▼' : '▲'}</button>
          <button className={styles.iconBtnSm} style={{ color: '#f55' }} onClick={onDelete}>×</button>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.nodeBody}>
          {/* DIALOG */}
          {node.type === 'dialog' && (
            <>
              <DialogLineEditor lines={node.lines} onChange={lines => onUpdate({ ...node, lines })} />
              <NextPicker value={node.next} nodeIds={otherIds} onChange={next => onUpdate({ ...node, next })} />
            </>
          )}

          {/* OPTIONS */}
          {node.type === 'options' && (
            <div className={styles.optionEditorList}>
              {node.options.map((opt, i) => (
                <div key={i} className={styles.optionEditorRow}>
                  <input
                    className={styles.lineText}
                    placeholder="Texto de la opción"
                    value={opt.text}
                    onChange={e => {
                      const next = [...node.options]
                      next[i] = { ...next[i], text: e.target.value }
                      onUpdate({ ...node, options: next })
                    }}
                  />
                  <NextPicker
                    value={opt.next}
                    nodeIds={otherIds}
                    label={`op${i + 1}→`}
                    onChange={nextId => {
                      const next = [...node.options]
                      next[i] = { ...next[i], next: nextId }
                      onUpdate({ ...node, options: next })
                    }}
                  />
                  <label className={styles.inlineCheck}>
                    ₽ mín.
                    <input
                      type="number"
                      className={styles.lineActor}
                      placeholder="0"
                      value={opt.condition?.pokedollars ?? ''}
                      onChange={e => {
                        const val = e.target.value ? Number(e.target.value) : undefined
                        const next = [...node.options]
                        next[i] = { ...next[i], condition: val !== undefined ? { pokedollars: val } : undefined }
                        onUpdate({ ...node, options: next })
                      }}
                    />
                  </label>
                  <button className={styles.iconBtn} onClick={() => onUpdate({ ...node, options: node.options.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <button className={styles.addRowBtn} onClick={() => onUpdate({ ...node, options: [...node.options, { text: '', next: null }] })}>
                + Opción
              </button>
            </div>
          )}

          {/* COMBAT */}
          {node.type === 'combat' && (
            <>
              <div className={styles.lineList}>
                {node.pokemons.map((p, i) => (
                  <PokemonRowEditor
                    key={i}
                    poke={p}
                    onChange={updated => {
                      const next = [...node.pokemons]
                      next[i] = updated
                      onUpdate({ ...node, pokemons: next })
                    }}
                    onDelete={() => onUpdate({ ...node, pokemons: node.pokemons.filter((_, j) => j !== i) })}
                  />
                ))}
                {node.pokemons.length < 6 && (
                  <button className={styles.addRowBtn} onClick={() => setShowPicker(true)}>
                    + Pokémon
                  </button>
                )}
              </div>
              <NextPicker value={node.on_win}  nodeIds={otherIds} label="→ victoria" onChange={on_win  => onUpdate({ ...node, on_win  })} />
              <NextPicker value={node.on_lose} nodeIds={otherIds} label="→ derrota"  onChange={on_lose => onUpdate({ ...node, on_lose })} />
              {showPicker && (
                <PokemonPickerModal
                  onSelect={id => {
                    onUpdate({ ...node, pokemons: [...node.pokemons, { id, item: null, is_shiny: false, level: 0 }] })
                    setShowPicker(false)
                  }}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </>
          )}

          {/* GIFT */}
          {node.type === 'gift' && (
            <>
              <div className={styles.lineList}>
                {node.gifts.map((g, i) => (
                  <GiftRowEditor
                    key={i}
                    gift={g}
                    onChange={updated => {
                      const next = [...node.gifts]
                      next[i] = updated
                      onUpdate({ ...node, gifts: next })
                    }}
                    onDelete={() => onUpdate({ ...node, gifts: node.gifts.filter((_, j) => j !== i) })}
                  />
                ))}
                <button className={styles.addRowBtn} onClick={() => onUpdate({
                  ...node,
                  gifts: [...node.gifts, { type: 'pokedollars', quantity: 0 } as Gift]
                })}>
                  + Recompensa
                </button>
              </div>
              <NextPicker value={node.next} nodeIds={otherIds} onChange={next => onUpdate({ ...node, next })} />
            </>
          )}
          {/* EXCHANGE */}
          {node.type === 'exchange' && (
            <div className={styles.lineList}>
              {node.offers.map((offer, i) => (
                <div key={i} className={styles.exchangeOfferRow}>
                  <input
                    className={styles.lineText}
                    placeholder="Texto del botón"
                    value={offer.label}
                    onChange={e => {
                      const next = [...node.offers]; next[i] = { ...next[i], label: e.target.value }
                      onUpdate({ ...node, offers: next })
                    }}
                  />
                  <select
                    className={styles.lineActor}
                    value={offer.give ?? ''}
                    onChange={e => {
                      const next = [...node.offers]; next[i] = { ...next[i], give: e.target.value || null }
                      onUpdate({ ...node, offers: next })
                    }}
                  >
                    <option value="">— sin dar —</option>
                    {[...Array(6)].map((_, k) => (
                      <option key={k} value={`team_random_${k}`}>team_random_{k}</option>
                    ))}
                  </select>
                  <span className={styles.nextLabel}>→</span>
                  <select
                    className={styles.lineActor}
                    value={offer.receive ?? ''}
                    onChange={e => {
                      const next = [...node.offers]; next[i] = { ...next[i], receive: e.target.value || null }
                      onUpdate({ ...node, offers: next })
                    }}
                  >
                    <option value="">— sin recibir —</option>
                    <option value="pool_random">pool_random</option>
                    {[...Array(6)].map((_, k) => (
                      <option key={k} value={`pool_${k}`}>pool_{k}</option>
                    ))}
                  </select>
                  <label className={styles.checkLabel} title="Ocultar qué Pokémon se recibe">
                    <input
                      type="checkbox"
                      checked={!!offer.hide_receive}
                      onChange={e => {
                        const next = [...node.offers]; next[i] = { ...next[i], hide_receive: e.target.checked }
                        onUpdate({ ...node, offers: next })
                      }}
                    />
                    ?
                  </label>
                  <NextPicker value={offer.next} nodeIds={otherIds} label="sig→" onChange={nextId => {
                    const next = [...node.offers]; next[i] = { ...next[i], next: nextId }
                    onUpdate({ ...node, offers: next })
                  }} />
                  <button className={styles.iconBtn} onClick={() => onUpdate({ ...node, offers: node.offers.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <button className={styles.addRowBtn} onClick={() => onUpdate({
                ...node, offers: [...node.offers, { label: '', give: null, receive: null, next: null }]
              })}>
                + Oferta
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── Export modal ──────────────────────────────────────────────────────────────

function ExportModal({ scene, onClose }: { scene: SceneData; onClose: () => void }) {
  const json    = JSON.stringify(scene, null, 2)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className={styles.exportOverlay} onClick={onClose}>
      <div className={styles.exportModal} onClick={e => e.stopPropagation()}>
        <div className={styles.exportHeader}>
          <span>JSON — {scene.scene_id}</span>
          <div className={styles.exportActions}>
            <button className={styles.exportCopy} onClick={copy}>{copied ? '✓ Copiado' : 'Copiar'}</button>
            <button className={styles.iconBtn} onClick={onClose}>×</button>
          </div>
        </div>
        <pre className={styles.exportPre}>{json}</pre>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { onBack: () => void }

export function SceneEditor({ onBack }: Props) {
  const [scene,       setScene]       = useState<SceneData>(() => loadDraft() ?? emptyScene())
  const [showExport,  setShowExport]  = useState(false)
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [newNodeType, setNewNodeType] = useState<SceneNode['type']>('dialog')
  const [newNodeId,   setNewNodeId]   = useState('')
  const [search,      setSearch]      = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const persist = (updated: SceneData) => {
    setScene(updated)
    saveDraft(updated)
  }

  // Load an existing scene into the editor
  const loadScene = (src: SceneData) => {
    const draft = structuredClone(src)
    persist(draft)
  }

  // ── Metadata ──────────────────────────────────────────────────────────────
  const updateMeta = (field: keyof SceneData, value: string) =>
    persist({ ...scene, [field]: value })

  // ── Actors ────────────────────────────────────────────────────────────────
  const addActor = () =>
    persist({ ...scene, actors: [...scene.actors, { id: scene.actors.length, name: '', sprite: '' }] })

  const updateActor = (i: number, field: keyof Actor, val: string) => {
    const next = [...scene.actors]
    next[i] = { ...next[i], [field]: val }
    persist({ ...scene, actors: next })
  }

  const deleteActor = (i: number) =>
    persist({ ...scene, actors: scene.actors.filter((_, j) => j !== i) })

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const nodeIds = Object.keys(scene.nodes)

  const addNode = () => {
    const id = newNodeId.trim() || `n${nodeIds.length}`
    if (scene.nodes[id]) return   // duplicate ID
    const nodes   = { ...scene.nodes, [id]: emptyNode(newNodeType) }
    const start   = scene.start ?? id
    persist({ ...scene, nodes, start })
    setNewNodeId('')
  }

  const updateNode = useCallback((id: string, node: SceneNode) => {
    persist({ ...scene, nodes: { ...scene.nodes, [id]: node } })
  }, [scene])

  const deleteNode = (id: string) => {
    const nodes = { ...scene.nodes }
    delete nodes[id]
    const start = scene.start === id ? null : scene.start
    persist({ ...scene, nodes, start })
  }

  const renameNode = (oldId: string, newId: string) => {
    if (!newId || scene.nodes[newId]) return
    const nodes: Record<string, SceneNode> = {}
    for (const [k, v] of Object.entries(scene.nodes)) {
      const remapped = remapNodeRefs(v, oldId, newId)
      nodes[k === oldId ? newId : k] = remapped
    }
    const start = scene.start === oldId ? newId : scene.start
    persist({ ...scene, nodes, start })
  }

  const setStart = (id: string) => persist({ ...scene, start: id })

  const saveToFile = async () => {
    setSaveStatus('saving')
    try {
      const res  = await fetch('/api/save-scene', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ scene }),
      })
      const data = await res.json()
      setSaveStatus(data.ok ? 'ok' : 'error')
    } catch {
      setSaveStatus('error')
    } finally {
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }

  // Filtered scene list
  const filteredScenes = ALL_SCENES.filter(s => {
    const matchCat = activeCategory === 'all' || s.category === activeCategory
    const matchSearch = s.scene_name.toLowerCase().includes(search.toLowerCase()) ||
                        s.scene_id.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className={styles.overlay}>
    <div className={styles.editor}>

      {/* ── Left: scene browser ──────────────────────────────────────────── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button className={styles.backBtn} onClick={onBack}>← Volver</button>
          <button className={styles.newBtn} onClick={() => persist(emptyScene())}>+ Nueva</button>
        </div>
        <input
          className={styles.searchInput}
          placeholder="Buscar escena…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.catTabs}>
          {['all', ...CATEGORIES].map(c => (
            <button
              key={c}
              className={`${styles.catTab} ${activeCategory === c ? styles.catTabActive : ''}`}
              onClick={() => setActiveCategory(c)}
            >
              {c === 'all' ? 'Todas' : CAT_LABELS[c] ?? c}
            </button>
          ))}
        </div>
        <div className={styles.sceneList}>
          {filteredScenes.map(s => (
            <button
              key={s.scene_id}
              className={`${styles.sceneItem} ${s.scene_id === scene.scene_id ? styles.sceneItemActive : ''}`}
              onClick={() => loadScene(s)}
              title={s.scene_id}
            >
              <span className={styles.sceneItemCat}>{CAT_LABELS[s.category] ?? s.category}</span>
              <span className={styles.sceneItemName}>{s.scene_name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: editor ────────────────────────────────────────────────── */}
      <div className={styles.main}>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitle}>Editor de Escenas</span>
          <div className={styles.toolbarActions}>
            <button className={styles.exportBtn} onClick={() => setShowExport(true)}>Exportar JSON</button>
            <button
              className={`${styles.saveBtn} ${styles[`saveBtnStatus_${saveStatus}`]}`}
              disabled={saveStatus === 'saving'}
              onClick={saveToFile}
            >
              {saveStatus === 'saving' ? 'Guardando…' :
               saveStatus === 'ok'     ? '✓ Guardado' :
               saveStatus === 'error'  ? '✗ Error'    : 'Guardar en archivo'}
            </button>
          </div>
        </div>

      <div className={styles.mainContent}>
        {/* Metadata */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Metadatos</h3>
          <div className={styles.metaGrid}>
            <label className={styles.metaLabel}>ID
              <input className={styles.metaInput} value={scene.scene_id}
                onChange={e => updateMeta('scene_id', e.target.value)} />
            </label>
            <label className={styles.metaLabel}>Nombre
              <input className={styles.metaInput} value={scene.scene_name}
                onChange={e => updateMeta('scene_name', e.target.value)} />
            </label>
            <label className={styles.metaLabel}>Categoría
              <select className={styles.metaInput} value={scene.category}
                onChange={e => updateMeta('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c] ?? c}</option>)}
              </select>
            </label>
          </div>
        </section>

        {/* Actors */}
        <section className={styles.section}>
          <div className={styles.sectionRow}>
            <h3 className={styles.sectionTitle}>Actores</h3>
            <button className={styles.addRowBtn} onClick={addActor}>+ Actor</button>
          </div>
          {scene.actors.map((actor, i) => (
            <div key={i} className={styles.lineRow}>
              <input className={styles.lineActor} placeholder="id" value={String(actor.id)}
                onChange={e => updateActor(i, 'id', e.target.value)} />
              <input className={styles.lineText} placeholder="nombre"  value={actor.name}
                onChange={e => updateActor(i, 'name', e.target.value)} />
              <input className={styles.lineText} placeholder="sprite (historias/…)" value={actor.sprite}
                onChange={e => updateActor(i, 'sprite', e.target.value)} />
              <button className={styles.iconBtn} onClick={() => deleteActor(i)}>×</button>
            </div>
          ))}
        </section>

        {/* Exchange config */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Configuración de intercambio</h3>
          <div className={styles.metaGrid}>
            <label className={styles.metaLabel}>
              Slots team random (0 = todo el equipo)
              <input
                className={styles.metaInput}
                type="number" min={0} max={6}
                value={scene.team_random_count ?? 0}
                onChange={e => persist({ ...scene, team_random_count: Number(e.target.value) || undefined })}
              />
            </label>
            {Object.entries(scene.nodes).some(([, n]) => n.type === 'combat') && (
              <label className={styles.metaLabel}>
                Pool desde combate
                <select
                  className={styles.metaInput}
                  value={scene.pool_from_combat ?? ''}
                  onChange={e => persist({
                    ...scene,
                    pool_from_combat: e.target.value || undefined,
                    pokemon_pool: e.target.value ? [] : scene.pokemon_pool,
                  })}
                >
                  <option value="">— manual —</option>
                  {Object.entries(scene.nodes)
                    .filter(([, n]) => n.type === 'combat')
                    .map(([id]) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                </select>
              </label>
            )}
          </div>
          {scene.pool_from_combat ? (
            <p className={styles.poolFromCombatHint}>
              El pool se capturará automáticamente al ganar el combate «{scene.pool_from_combat}».
            </p>
          ) : (
            <div className={styles.lineList} style={{ marginTop: 10 }}>
              {(scene.pokemon_pool ?? []).map((sp, i) => (
                <PokemonRowEditor
                  key={i}
                  poke={sp}
                  onChange={updated => {
                    const next = [...(scene.pokemon_pool ?? [])]
                    next[i] = updated
                    persist({ ...scene, pokemon_pool: next })
                  }}
                  onDelete={() => persist({ ...scene, pokemon_pool: (scene.pokemon_pool ?? []).filter((_, j) => j !== i) })}
                />
              ))}
              {(scene.pokemon_pool?.length ?? 0) < 6 && (
                <button className={styles.addRowBtn} onClick={() => persist({
                  ...scene,
                  pokemon_pool: [...(scene.pokemon_pool ?? []), { id: 1, item: null, is_shiny: false, level: 0 }]
                })}>
                  + Pokémon del pool (pool_{scene.pokemon_pool?.length ?? 0})
                </button>
              )}
            </div>
          )}
        </section>

        {/* Nodes */}
        <section className={styles.section}>
          <div className={styles.sectionRow}>
            <h3 className={styles.sectionTitle}>
              Nodos <span className={styles.startHint}>nodo inicio: {scene.start ?? '—'}</span>
            </h3>
            <div className={styles.addNodeRow}>
              <input
                className={styles.lineActor}
                placeholder="id del nodo"
                value={newNodeId}
                onChange={e => setNewNodeId(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNode() }}
              />
              <select className={styles.lineActor} value={newNodeType}
                onChange={e => setNewNodeType(e.target.value as SceneNode['type'])}>
                <option value="dialog">dialog</option>
                <option value="options">options</option>
                <option value="combat">combat</option>
                <option value="gift">gift</option>
                <option value="exchange">exchange</option>
              </select>
              <button className={styles.addRowBtn} onClick={addNode}>+ Nodo</button>
            </div>
          </div>

          <div className={styles.nodeList}>
            {nodeIds.length === 0 && (
              <p className={styles.emptyHint}>Sin nodos. Añade uno arriba.</p>
            )}
            {nodeIds.map(id => (
              <NodeCard
                key={id}
                nodeId={id}
                node={scene.nodes[id]}
                nodeIds={nodeIds}
                isStart={scene.start === id}
                onUpdate={node => updateNode(id, node)}
                onRename={newId => renameNode(id, newId)}
                onDelete={() => deleteNode(id)}
                onSetStart={() => setStart(id)}
              />
            ))}
          </div>
        </section>

      </div>

      </div>

      {showExport && <ExportModal scene={scene} onClose={() => setShowExport(false)} />}
    </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function remapRef(val: string | null, oldId: string, newId: string): string | null {
  return val === oldId ? newId : val
}

function remapNodeRefs(node: SceneNode, oldId: string, newId: string): SceneNode {
  switch (node.type) {
    case 'dialog':
      return { ...node, next: remapRef(node.next, oldId, newId) }
    case 'options':
      return { ...node, options: node.options.map(o => ({ ...o, next: remapRef(o.next, oldId, newId) })) }
    case 'combat':
      return { ...node, on_win: remapRef(node.on_win, oldId, newId), on_lose: remapRef(node.on_lose, oldId, newId) }
    case 'gift':
      return { ...node, next: remapRef(node.next, oldId, newId) }
    case 'exchange':
      return { ...node, offers: node.offers.map(o => ({ ...o, next: remapRef(o.next, oldId, newId) })) }
  }
}
