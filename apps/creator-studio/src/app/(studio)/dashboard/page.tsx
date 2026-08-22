'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudioStore } from '@/store/studioStore'
import { useUser } from '@/hooks/useUser'
import { useBooks } from '@/hooks/useBooks'
import { Header } from '@/components/layout/Header'
import {
  Plus, BookOpen, Clock, Music, Mic, MoreVertical,
  Edit3, Trash2, Eye, Copy, TrendingUp, Users, DollarSign,
  Globe, FileText, Loader2, Upload, Pencil
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Story, Chapter } from '@/types'
import { concatenatePageCastFiles, isPageCastFile, parseText } from '@/lib/textParser'
import { autoCreateMissingCast, buildCharacterNameMap, resolveBlockCharacter, newId } from '@/lib/importPipeline'
import { replaceBookContent } from '@/lib/supabase/blocks'

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any, label: string, value: string, sub?: string, color: string }) {
  return (
    <div className="card flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl', color)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight text-text-primary sm:text-xl">{value}</div>
        <div className="text-text-secondary text-xs">{label}</div>
        {sub && <div className="text-text-muted text-[10px] mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function StoryCard({ story, onEdit, onDelete, onDuplicate, onPublish, onRename }: {
  story: Story
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onPublish: () => void
  onRename: (newTitle: string) => Promise<void>
}) {
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [duplicating,    setDuplicating]    = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [renaming,       setRenaming]       = useState(false)
  const [titleDraft,     setTitleDraft]     = useState(story.title)
  const [savingRename,   setSavingRename]   = useState(false)

  const coverColors = ['from-accent/30 to-accent/10', 'from-gold/30 to-gold/10', 'from-info/30 to-info/10', 'from-success/30 to-success/10']
  const colorIdx = story.id.charCodeAt(story.id.length - 1) % coverColors.length
  const isPublished = story.status === 'published'

  const handleDuplicate = async () => {
    setMenuOpen(false)
    setDuplicating(true)
    await onDuplicate()
    setDuplicating(false)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    await onDelete()
    // No need to reset state — the card unmounts once the story leaves the list.
  }

  const handleOpenRename = () => {
    setMenuOpen(false)
    setTitleDraft(story.title)
    setRenaming(true)
  }

  const handleSaveRename = async () => {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === story.title) { setRenaming(false); return }
    setSavingRename(true)
    await onRename(trimmed)
    setSavingRename(false)
    setRenaming(false)
  }

  return (
    <div className="card group transition-all duration-200 hover:border-accent/30">
      {/* Cover */}
      <div className={clsx('h-32 rounded-t-xl overflow-hidden bg-gradient-to-br flex items-center justify-center relative', coverColors[colorIdx])}>
        <BookOpen size={36} className="text-white/20" />
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className={clsx(
            isPublished ? 'badge-published' :
            story.status === 'draft' ? 'badge-draft' : 'badge-archived'
          )}>
            {story.status}
          </span>
        </div>
        {/* Quick actions overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-bg-primary/60 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={onEdit} className="btn-primary text-xs px-3 py-1.5">
            <Edit3 size={13} /> Edit
          </button>
          <button
            onClick={() => { onPublish(); }}
            className={clsx('text-xs px-3 py-1.5', isPublished ? 'btn-secondary' : 'btn-secondary')}
          >
            {isPublished ? <><FileText size={13} /> Unpublish</> : <><Globe size={13} /> Publish</>}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-text-primary font-semibold text-sm truncate">{story.title}</h3>
            <p className="text-text-muted text-xs mt-0.5 line-clamp-2 leading-relaxed">{story.description}</p>
          </div>
          <div className="relative shrink-0">
            <button
              className="btn-ghost p-1"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 card-elevated w-44 py-1 text-xs animate-fade-in">
                <button onClick={() => { onEdit(); setMenuOpen(false) }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
                  <Edit3 size={12} /> Continue editing
                </button>
                <button onClick={handleOpenRename} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
                  <Pencil size={12} /> Rename
                </button>
                <button onClick={handleDuplicate} disabled={duplicating} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
                  {duplicating ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                  {duplicating ? 'Duplicating…' : 'Duplicate'}
                </button>
                <button onClick={() => { onPublish(); setMenuOpen(false) }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
                  {isPublished ? <><FileText size={12} /> Unpublish</> : <><Globe size={12} /> Publish</>}
                </button>
                <div className="my-1 border-t border-bg-border" />
                <button onClick={() => { setMenuOpen(false); setConfirmDelete(true) }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-danger/10 text-text-muted hover:text-danger transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-3 text-text-muted text-[10px]">
          {story.durationMinutes && (
            <span className="flex items-center gap-1"><Clock size={10} /> {story.durationMinutes}m</span>
          )}
          {story.hasMusic && (
            <span className="flex items-center gap-1"><Music size={10} /> Music</span>
          )}
          <span className="flex items-center gap-1"><Mic size={10} /> {story.characters.length} cast</span>
          <span className="ml-auto font-medium text-text-secondary">${story.price.toFixed(2)}</span>
        </div>
      </div>

      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm animate-fade-in" onClick={() => !savingRename && setRenaming(false)}>
          <div className="card-elevated w-full max-w-sm space-y-4 p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-text-primary font-bold text-base">Rename book</h3>
              <p className="text-text-secondary text-sm mt-1.5">Give this Castlet a new title.</p>
            </div>
            <input
              autoFocus
              className="input w-full"
              value={titleDraft}
              maxLength={200}
              disabled={savingRename}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveRename()
                if (e.key === 'Escape') setRenaming(false)
              }}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary" onClick={() => setRenaming(false)} disabled={savingRename}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveRename} disabled={savingRename || !titleDraft.trim()}>
                {savingRename ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm animate-fade-in" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="card-elevated w-full max-w-sm space-y-4 p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-text-primary font-bold text-base">Delete "{story.title}"?</h3>
              <p className="text-text-secondary text-sm mt-1.5">
                This permanently deletes the book — its chapters, scenes, blocks, and cast. This cannot be undone.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
              <button className="btn-danger" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete book</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Races a promise against a timeout so a hung network call surfaces as a visible
 * error instead of leaving the UI stuck silently forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s — check your Supabase connection/credentials.`)), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) }
    )
  })
}

const PREF_PRICE_KEY = 'pagecast_default_price'

function readDefaultPrice(): number {
  if (typeof window === 'undefined') return 0
  const saved = Number(localStorage.getItem(PREF_PRICE_KEY) ?? '0')
  return Number.isFinite(saved) && saved > 0 ? saved : 0
}

function NewStoryModal({ onClose, onCreate, onImportFiles, importing, importStep, importError }: {
  onClose: () => void
  onCreate: (title: string, desc: string, price: number) => void
  onImportFiles: (fileList: FileList) => void
  importing: boolean
  importStep: string
  importError: string | null
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [accessMode, setAccessMode] = useState<'free' | 'paid'>(() => readDefaultPrice() > 0 ? 'paid' : 'free')
  const [price, setPrice] = useState(() => {
    const defaultPrice = readDefaultPrice()
    return defaultPrice > 0 ? defaultPrice.toFixed(2) : '4.99'
  })
  const parsedPrice = Math.max(0.5, Number(price) || 4.99)
  const importFilesRef = useRef<HTMLInputElement>(null)

  // Log at the absolute first possible moment, before any React state or async
  // code runs, so we can tell "button click never registered" apart from
  // "it registered but something after it failed silently."
  const handlePickFilesClick = () => {
    console.log('[NewStoryModal] "Import script files" button clicked, opening picker')
    importFilesRef.current?.click()
  }

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = e.target.files?.length ?? 0
    console.log(`[NewStoryModal] file input onChange fired — ${count} file(s) chosen`)
    if (e.target.files && count > 0) onImportFiles(e.target.files)
    e.target.value = ''
  }

  if (importing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm animate-fade-in">
        <div className="card-elevated w-full max-w-sm space-y-4 p-6 text-center animate-slide-up">
          <Loader2 size={28} className="text-accent animate-spin mx-auto" />
          <div>
            <p className="text-text-primary font-semibold text-sm">Importing your story…</p>
            <p className="text-text-muted text-xs mt-1">{importStep || 'Working…'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="card-elevated max-h-[92dvh] w-full max-w-md space-y-5 overflow-y-auto p-5 animate-slide-up sm:p-6">
        <div>
          <h2 className="text-text-primary font-bold text-lg">New Story</h2>
          <p className="text-text-secondary text-sm mt-1">Give your story a title and a brief description, or import an existing script below.</p>
        </div>

        {/* Import from PageCast script files — the only import path, kept to one reliable method */}
        <div className="rounded-lg border border-bg-border p-3 space-y-2">
          <p className="text-text-primary text-sm font-medium">Already have a script?</p>
          <p className="text-text-muted text-xs leading-relaxed">
            Select the *_pagecast.txt chapter/castlet files (e.g. from a .casts/&lt;story&gt;/script folder).
            Ctrl/Cmd-click to select more than one — each file becomes its own chapter.
          </p>
          <input
            ref={importFilesRef}
            type="file"
            multiple
            accept=".txt"
            className="hidden"
            onChange={handleFilesChosen}
          />
          <button
            className="btn-secondary w-full justify-center"
            onClick={handlePickFilesClick}
          >
            <Upload size={14} /> Import script files
          </button>
          {importError && <p className="text-danger text-xs whitespace-pre-line">{importError}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-bg-border" />
          <span className="text-text-muted text-xs">or start from scratch</span>
          <div className="h-px flex-1 bg-bg-border" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Story Title</label>
            <input className="input" placeholder="e.g. The Whispering Forest" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="A short description of your story…"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Access</label>
              <select className="input" value={accessMode} onChange={e => setAccessMode(e.target.value as 'free' | 'paid')}>
                <option value="free">Starter Cast</option>
                <option value="paid">Premium Cast</option>
              </select>
            </div>
            {accessMode === 'paid' && (
              <div>
                <label className="label">Unlock Price</label>
                <input
                  className="input"
                  type="number"
                  min="0.50"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!title.trim()}
            onClick={() => { if (title.trim()) onCreate(title.trim(), desc.trim(), accessMode === 'paid' ? parsedPrice : 0) }}
          >
            <Plus size={15} /> Create Story
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { setActiveStory, stories } = useStudioStore()
  const { loading: booksLoading, error: booksError, createBook, updateBook, deleteBook, publishBook, duplicateBook } = useBooks()
  const { displayName } = useUser()
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')
  const [folderImporting, setFolderImporting] = useState(false)
  const [folderStep, setFolderStep] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)

  const filtered = stories.filter((s: Story) => filter === 'all' || s.status === filter)

  const handleCreate = async (title: string, desc: string, price: number) => {
    const book = await createBook(title, desc, price)
    if (!book) return
    setShowModal(false)
    setActiveStory(book.id)
    router.push(`/studio/${book.id}`)
  }

  const handleEdit = (story: Story) => {
    setActiveStory(story.id)
    router.push(`/studio/${story.id}`)
  }

  const handleDuplicate = async (story: Story) => {
    await duplicateBook(story.id)
  }

  const handlePublish = async (story: Story) => {
    const newStatus = story.status === 'published' ? 'draft' : 'published'
    await publishBook(story.id, newStatus as 'draft' | 'published')
  }

  const handleRename = async (story: Story, newTitle: string) => {
    await updateBook(story.id, { title: newTitle })
  }

  // ── Import: build a brand-new book from a set of *_pagecast.txt chapter/castlet
  //    files (e.g. selected from a .casts/<story>/script folder). Triggered from
  //    inside the New Story modal — the one place you'd look to create a book. ──
  const handleImportFiles = (fileList: FileList) => {
    // Fire synchronously and log FIRST, before any state update or await, so this
    // line alone proves the click → onChange → here chain completed. If this
    // never appears in the console, the bug is upstream (button/input wiring),
    // not in this function.
    console.log(`[Dashboard] handleImportFiles called — ${fileList.length} file(s) selected`)
    void runImport(fileList)
  }

  const runImport = async (fileList: FileList) => {
    setFolderError(null)
    setFolderImporting(true)
    setFolderStep('Reading selected files…')

    try {
      const allFiles = Array.from(fileList)
      const txtFiles = allFiles.filter(f => /\.txt$/i.test(f.name))
      console.log(`[Dashboard] ${txtFiles.length} of ${allFiles.length} selected file(s) end in .txt`)

      if (txtFiles.length === 0) {
        setFolderError(`${allFiles.length} file${allFiles.length !== 1 ? 's' : ''} selected, but none end in .txt — manuscript .docx files are ignored.`)
        return
      }

      const withText = await Promise.all(
        txtFiles.map(async f => ({ name: f.name, text: await f.text() }))
      )
      const qualifying = withText.filter(f => isPageCastFile(f.text))
      console.log(`[Dashboard] ${qualifying.length} of ${txtFiles.length} .txt file(s) contain a ::PAGECAST_BOOK marker`)

      if (qualifying.length === 0) {
        setFolderError(`Found ${txtFiles.length} .txt file${txtFiles.length !== 1 ? 's' : ''}, but none are PageCast script files (no ::PAGECAST_BOOK marker).`)
        return
      }

      const { combinedText } = concatenatePageCastFiles(qualifying)
      const parsed = parseText(combinedText, 'pagecast')
      console.log(`[Dashboard] parsed ${parsed.chapters.length} chapter(s), ${parsed.cast?.length ?? 0} cast member(s)`)

      setFolderStep(`Creating the book "${parsed.meta?.title?.trim() || qualifying[0].name}"…`)
      const title = parsed.meta?.title?.trim() || qualifying[0].name.replace(/\.txt$/i, '')
      let book
      try {
        book = await withTimeout(createBook(title, '', 0), 15000, 'Creating the book')
      } catch (e: any) {
        console.error('[Dashboard] createBook call failed or timed out:', e)
        setFolderError(e?.message ?? 'Failed to create the new book.')
        return
      }
      if (!book) { setFolderError('Failed to create the new book (check that you are signed in — try reloading the page).'); return }
      console.log(`[Dashboard] created book ${book.id} — "${book.title}"`)

      if (parsed.meta?.genre || parsed.meta?.language) {
        setFolderStep('Setting genre/language…')
        await withTimeout(updateBook(book.id, {
          ...(parsed.meta.genre    ? { genre: parsed.meta.genre } : {}),
          ...(parsed.meta.language ? { language: parsed.meta.language } : {}),
        }), 15000, 'Updating book metadata')
      }

      // Auto-create cast from ::CAST blocks (skips characters that already match
      // by name — e.g. the default "Narrator" seeded on book creation).
      setFolderStep(`Creating cast (${parsed.cast?.length ?? 0} member(s) found)…`)
      const newCast = await withTimeout(autoCreateMissingCast(book.id, parsed.cast, book.characters), 20000, 'Creating cast members')
      console.log(`[Dashboard] auto-created ${newCast.length} of ${parsed.cast?.length ?? 0} cast member(s) (rest already existed)`)
      const allCharacters = [...book.characters, ...newCast]
      const nameMap = buildCharacterNameMap(allCharacters)

      const chapters: Chapter[] = parsed.chapters.map((ch, ci) => ({
        id: newId(),
        title: ch.title,
        order: ci + 1,
        scenes: ch.scenes.map(sc => ({
          id: newId(),
          title: sc.title,
          blocks: sc.blocks.map(b => resolveBlockCharacter(b, nameMap)),
        })),
      }))

      setFolderStep(`Saving ${chapters.length} chapter(s)…`)
      const saved = await withTimeout(replaceBookContent(book.id, { chapters }), 20000, 'Saving chapters')
      console.log(`[Dashboard] replaceBookContent saved=${saved}, ${chapters.length} chapter(s) written`)
      if (!saved) {
        setFolderError('Book was created, but saving the imported chapters failed. Open it and try Import Text again.')
        return
      }

      useStudioStore.setState(state => ({
        stories: state.stories.map(s => s.id === book.id
          ? { ...s, characters: allCharacters, chapters }
          : s),
      }))

      setShowModal(false)
      setActiveStory(book.id)
      router.push(`/studio/${book.id}`)
    } catch (err: any) {
      console.error('[Dashboard] import failed:', err)
      setFolderError('Import failed: ' + (err?.message ?? 'unknown error'))
    } finally {
      setFolderImporting(false)
      setFolderStep('')
    }
  }

  return (
    <>
      <Header>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Story
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-4 space-y-5 sm:p-6 sm:space-y-6">
        {/* DB error banner */}
        {booksError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {booksError}
          </div>
        )}

        {/* Welcome */}
        <div>
          <h2 className="text-lg font-bold text-text-primary sm:text-xl">
            Welcome back, {displayName} 👋
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            {stories.length === 0
              ? "You haven't created any stories yet. Start your first one!"
              : `You have ${stories.length} ${stories.length === 1 ? 'story' : 'stories'} in your library.`
            }
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard icon={BookOpen} label="Total Stories" value={String(stories.length)} color="bg-accent/20 text-accent" />
          <StatCard icon={TrendingUp} label="Published" value={String(stories.filter((s: Story) => s.status === 'published').length)} color="bg-success/20 text-success" />
          <StatCard icon={Users} label="Est. Readers" value="—" sub="Awaiting launch" color="bg-info/20 text-info" />
          <StatCard icon={DollarSign} label="Revenue" value="—" sub="Awaiting launch" color="bg-gold/20 text-gold" />
        </div>

        {/* Filter tabs + stories */}
        <div className="space-y-4">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-bg-border pb-3">
            {(['all', 'draft', 'published'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all',
                  filter === f
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                )}
              >
                {f}
                <span className="ml-1.5 text-[10px] text-text-muted">
                  {f === 'all' ? stories.length : stories.filter((s: Story) => s.status === f).length}
                </span>
              </button>
            ))}
          </div>

          {booksLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-text-secondary">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-text-secondary text-sm">Loading your stories…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4">
                <BookOpen size={28} className="text-text-muted" />
              </div>
              <p className="text-text-primary font-semibold">
                {filter === 'all' ? 'No stories yet' : `No ${filter} stories`}
              </p>
              <p className="text-text-secondary text-sm mt-1 max-w-xs">
                {filter === 'all'
                  ? 'Create your first story to get started.'
                  : `Switch the filter or create a new story.`}
              </p>
              {filter === 'all' && (
                <button className="btn-primary mt-5" onClick={() => setShowModal(true)}>
                  <Plus size={15} /> New Story
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((story: Story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onEdit={() => handleEdit(story)}
                  onDelete={() => deleteBook(story.id)}
                  onDuplicate={() => handleDuplicate(story)}
                  onPublish={() => handlePublish(story)}
                  onRename={(newTitle) => handleRename(story, newTitle)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New story modal */}
      {showModal && (
        <NewStoryModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          onImportFiles={handleImportFiles}
          importing={folderImporting}
          importStep={folderStep}
          importError={folderError}
        />
      )}
    </>
  )
}
