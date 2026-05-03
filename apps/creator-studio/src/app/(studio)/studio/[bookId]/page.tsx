'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStudioStore } from '@/store/studioStore'
import { BlockItem } from '@/components/editor/BlockItem'
import { AddBlockMenu } from '@/components/editor/AddBlockMenu'
import { Header } from '@/components/layout/Header'
import {
  Plus, ChevronRight, ChevronDown, Settings2, Eye,
  BookOpen, Layers, Music, Image as ImageIcon, Save,
  ArrowLeft, Trash2, Edit3, Check, X, Film
} from 'lucide-react'
import { clsx } from 'clsx'
import { v4 as uuid } from 'uuid'
import type { StoryBlock, BlockType, Chapter, Scene } from '@/types'

// ─── Scene Atmosphere Panel ───────────────────────────────────────────────────

const AMBIENCE_OPTIONS = ['forest-night.mp3', 'rain-city.mp3', 'desert-wind.mp3', 'ocean-waves.mp3', 'market-crowd.mp3', 'none']
const MUSIC_OPTIONS = ['mystery.mp3', 'adventure.mp3', 'calm-piano.mp3', 'dramatic.mp3', 'lullaby.mp3', 'none']

// ─── Inline editable title ────────────────────────────────────────────────────

function InlineEdit({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          className="input text-sm py-1 px-2 w-40"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onSave(draft); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
        />
        <button onClick={() => { onSave(draft); setEditing(false) }} className="text-success p-0.5"><Check size={13} /></button>
        <button onClick={() => setEditing(false)} className="text-danger p-0.5"><X size={13} /></button>
      </span>
    )
  }
  return (
    <span className={clsx('cursor-pointer hover:text-accent transition-colors group flex items-center gap-1', className)} onClick={() => setEditing(true)}>
      {value}
      <Edit3 size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
    </span>
  )
}

// ─── Main Studio Page ─────────────────────────────────────────────────────────

export default function StudioPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const router = useRouter()
  const store = useStudioStore()
  const story = store.stories.find(s => s.id === bookId)

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [rightPanel, setRightPanel] = useState<'scene' | 'block' | null>('scene')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (story?.chapters.length && !activeChapterId) {
      const firstChapter = story.chapters[0]
      setActiveChapterId(firstChapter.id)
      setExpandedChapters(new Set([firstChapter.id]))
      if (firstChapter.scenes.length) {
        setActiveSceneId(firstChapter.scenes[0].id)
      }
    }
  }, [story, activeChapterId])

  if (!story) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <BookOpen size={40} className="text-text-muted mx-auto" />
          <p className="text-text-secondary">Story not found.</p>
          <button className="btn-primary" onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const activeChapter = story.chapters.find(c => c.id === activeChapterId)
  const activeScene = activeChapter?.scenes.find(s => s.id === activeSceneId)

  // ── Handlers ──

  const handleAddChapter = () => {
    const ch = store.addChapter(story.id, `Scene ${story.chapters.length + 1}`)
    setActiveChapterId(ch.id)
    setExpandedChapters(prev => new Set(Array.from(prev).concat(ch.id)))
  }

  const handleAddScene = (chapterId: string) => {
    const chapter = story.chapters.find(c => c.id === chapterId)
    const sc = store.addScene(story.id, chapterId, `Beat ${(chapter?.scenes.length ?? 0) + 1}`)
    setActiveSceneId(sc.id)
  }

  const handleAddBlock = (type: BlockType) => {
    if (!activeChapterId || !activeSceneId) return
    const defaultChar = story.characters.find(c => c.role === 'character')?.id ?? story.characters[0]?.id ?? ''
    let block: StoryBlock
    switch (type) {
      case 'narration': block = { id: uuid(), type: 'narration', text: '' }; break
      case 'dialogue': block = { id: uuid(), type: 'dialogue', characterId: defaultChar, text: '', emotion: 'neutral' }; break
      case 'thought': block = { id: uuid(), type: 'thought', characterId: defaultChar, text: '' }; break
      case 'quote': block = { id: uuid(), type: 'quote', text: '', style: 'default' }; break
      case 'pause': block = { id: uuid(), type: 'pause', duration: 2 }; break
      case 'sfx': block = { id: uuid(), type: 'sfx', sfxFile: '', label: '' }; break
    }
    store.addBlock(story.id, activeChapterId, activeSceneId, block)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <>
      <Header title={story.title}>
        <button className="btn-ghost text-xs px-2 py-1.5" onClick={() => router.push('/dashboard')}>
          <ArrowLeft size={13} /> Dashboard
        </button>
        <button className="btn-secondary text-xs" onClick={() => {}}>
          <Eye size={13} /> Preview
        </button>
        <button className={clsx('text-xs', saved ? 'btn-secondary text-success' : 'btn-primary')} onClick={handleSave}>
          {saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save</>}
        </button>
      </Header>

      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT: Chapter / Scene Navigator ── */}
        <aside className="w-52 shrink-0 border-r border-bg-border bg-bg-secondary overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-bg-border">
            <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Chapters</span>
            <button onClick={handleAddChapter} className="text-text-muted hover:text-accent transition-colors p-0.5">
              <Plus size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {story.chapters.length === 0 ? (
              <div className="text-center py-8 px-3 space-y-2">
                <Layers size={24} className="text-text-muted mx-auto" />
                <p className="text-text-muted text-xs">No chapters yet</p>
                <button onClick={handleAddChapter} className="btn-secondary text-xs w-full justify-center">
                  <Plus size={11} /> Add chapter
                </button>
              </div>
            ) : (
              story.chapters.map(chapter => (
                <div key={chapter.id}>
                  {/* Chapter row */}
                  <div
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-2 cursor-pointer group',
                      activeChapterId === chapter.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    )}
                    onClick={() => { setActiveChapterId(chapter.id); toggleChapter(chapter.id) }}
                  >
                    <button className="shrink-0 text-text-muted hover:text-text-secondary" onClick={e => { e.stopPropagation(); toggleChapter(chapter.id) }}>
                      {expandedChapters.has(chapter.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <BookOpen size={11} className="shrink-0 text-text-muted" />
                    <InlineEdit
                      value={chapter.title}
                      onSave={v => store.updateChapter(story.id, chapter.id, { title: v })}
                      className="text-xs flex-1 min-w-0 truncate"
                    />
                    <button
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                      onClick={e => { e.stopPropagation(); store.deleteChapter(story.id, chapter.id) }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>

                  {/* Scenes */}
                  {expandedChapters.has(chapter.id) && (
                    <div className="pl-5 pb-1">
                      {chapter.scenes.map(scene => (
                        <div
                          key={scene.id}
                          className={clsx(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs group',
                            activeSceneId === scene.id
                              ? 'bg-accent/15 text-accent'
                              : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
                          )}
                          onClick={() => { setActiveSceneId(scene.id); setActiveChapterId(chapter.id) }}
                        >
                          <Film size={10} className="shrink-0" />
                          <InlineEdit
                            value={scene.title}
                            onSave={v => store.updateScene(story.id, chapter.id, scene.id, { title: v })}
                            className="flex-1 min-w-0 truncate"
                          />
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-text-muted">
                            {scene.blocks.length}
                          </span>
                          <button
                            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                            onClick={e => { e.stopPropagation(); store.deleteScene(story.id, chapter.id, scene.id) }}
                          >
                            <Trash2 size={9} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-accent transition-colors w-full"
                        onClick={() => handleAddScene(chapter.id)}
                      >
                        <Plus size={10} /> Add scene
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── CENTER: Block Editor Canvas ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeScene ? (
            <>
              {/* Scene header bar */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-bg-border bg-bg-secondary/50 shrink-0">
                <Film size={14} className="text-text-muted" />
                <div className="text-text-secondary text-sm">
                  <span className="text-text-muted">{activeChapter?.title}</span>
                  <ChevronRight size={12} className="inline mx-1 text-text-muted" />
                  <span className="text-text-primary font-medium">{activeScene.title}</span>
                </div>
                <div className="ml-auto flex items-center gap-2 text-text-muted text-xs">
                  {activeScene.blocks.length} beat{activeScene.blocks.length !== 1 ? 's' : ''}
                  <button
                    className={clsx('btn-ghost text-xs px-2 py-1', rightPanel === 'scene' && 'bg-accent/15 text-accent')}
                    onClick={() => setRightPanel(rightPanel === 'scene' ? null : 'scene')}
                  >
                    <Settings2 size={12} /> Atmosphere
                  </button>
                </div>
              </div>

              {/* Blocks */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {activeScene.blocks.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-dashed border-bg-border flex items-center justify-center mx-auto">
                      <Plus size={22} className="text-text-muted" />
                    </div>
                    <p className="text-text-secondary text-sm">This scene has no story beats yet.</p>
                    <p className="text-text-muted text-xs">Add a Narration, Dialogue, or other block below.</p>
                  </div>
                ) : (
                  activeScene.blocks.map((block, idx) => (
                    <BlockItem
                      key={block.id}
                      block={block}
                      characters={story.characters}
                      onUpdate={updates => store.updateBlock(story.id, activeChapterId!, activeSceneId!, block.id, updates)}
                      onDelete={() => store.deleteBlock(story.id, activeChapterId!, activeSceneId!, block.id)}
                      dragHandleProps={{}}
                    />
                  ))
                )}

                {/* Add block */}
                <div className="pt-2">
                  <AddBlockMenu onAdd={handleAddBlock} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Layers size={48} className="text-text-muted mx-auto" />
                <div>
                  <p className="text-text-secondary font-medium">No scene selected</p>
                  <p className="text-text-muted text-sm mt-1">
                    {story.chapters.length === 0
                      ? 'Start by adding your first chapter.'
                      : 'Select or create a scene in the left panel.'}
                  </p>
                </div>
                {story.chapters.length === 0 && (
                  <button className="btn-primary mx-auto" onClick={handleAddChapter}>
                    <Plus size={14} /> Add First Chapter
                  </button>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ── RIGHT: Scene Properties ── */}
        {rightPanel && activeScene && (
          <aside className="w-56 shrink-0 border-l border-bg-border bg-bg-secondary overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-bg-border">
              <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Scene Atmosphere</span>
              <button onClick={() => setRightPanel(null)} className="text-text-muted hover:text-text-secondary"><X size={13} /></button>
            </div>

            <div className="p-3 space-y-4">
              {/* Ambience */}
              <div>
                <label className="label flex items-center gap-1"><Music size={10} /> Ambience</label>
                <select
                  className="input text-xs"
                  value={activeScene.ambienceFile ?? 'none'}
                  onChange={e => store.updateScene(story.id, activeChapterId!, activeSceneId!, { ambienceFile: e.target.value === 'none' ? undefined : e.target.value })}
                >
                  {AMBIENCE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Music */}
              <div>
                <label className="label flex items-center gap-1"><Music size={10} /> Background Music</label>
                <select
                  className="input text-xs"
                  value={activeScene.musicFile ?? 'none'}
                  onChange={e => store.updateScene(story.id, activeChapterId!, activeSceneId!, { musicFile: e.target.value === 'none' ? undefined : e.target.value })}
                >
                  {MUSIC_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Scene image */}
              <div>
                <label className="label flex items-center gap-1"><ImageIcon size={10} /> Scene Image</label>
                <button className="btn-secondary w-full justify-center text-xs">
                  <Plus size={11} /> Upload Image
                </button>
              </div>

              {/* Beat summary */}
              <div className="pt-2 border-t border-bg-border space-y-1.5">
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Beat Summary</p>
                {(['narration', 'dialogue', 'thought', 'quote', 'pause', 'sfx'] as const).map(type => {
                  const count = activeScene.blocks.filter(b => b.type === type).length
                  if (!count) return null
                  return (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span className="text-text-muted capitalize">{type}</span>
                      <span className="text-text-secondary font-medium">{count}</span>
                    </div>
                  )
                })}
                {activeScene.blocks.length === 0 && <p className="text-text-muted text-xs">No beats yet</p>}
              </div>
            </div>
          </aside>
        )}
      </div>
    </>
  )
}
