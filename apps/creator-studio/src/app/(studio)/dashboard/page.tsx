'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudioStore } from '@/store/studioStore'
import { useUser } from '@/hooks/useUser'
import { useBooks } from '@/hooks/useBooks'
import { Header } from '@/components/layout/Header'
import {
  Plus, BookOpen, Clock, Music, Mic, MoreVertical,
  Edit3, Trash2, Eye, Copy, TrendingUp, Users, DollarSign,
  Globe, FileText, Loader2
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Story } from '@/types'

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any, label: string, value: string, sub?: string, color: string }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-text-primary font-bold text-xl leading-tight">{value}</div>
        <div className="text-text-secondary text-xs">{label}</div>
        {sub && <div className="text-text-muted text-[10px] mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function StoryCard({ story, onEdit, onDelete, onDuplicate, onPublish }: {
  story: Story
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onPublish: () => void
}) {
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [duplicating,    setDuplicating]    = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  const coverColors = ['from-accent/30 to-accent/10', 'from-gold/30 to-gold/10', 'from-info/30 to-info/10', 'from-success/30 to-success/10']
  const colorIdx = story.id.charCodeAt(story.id.length - 1) % coverColors.length
  const isPublished = story.status === 'published'

  const handleDuplicate = async () => {
    setMenuOpen(false)
    setDuplicating(true)
    await onDuplicate()
    setDuplicating(false)
  }

  return (
    <div className="card hover:border-accent/30 transition-all duration-200 overflow-hidden group">
      {/* Cover */}
      <div className={clsx('h-32 bg-gradient-to-br flex items-center justify-center relative', coverColors[colorIdx])}>
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
        <div className="absolute inset-0 bg-bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
    </div>
  )
}

const PREF_PRICE_KEY = 'pagecast_default_price'

function readDefaultPrice(): number {
  if (typeof window === 'undefined') return 0
  const saved = Number(localStorage.getItem(PREF_PRICE_KEY) ?? '0')
  return Number.isFinite(saved) && saved > 0 ? saved : 0
}

function NewStoryModal({ onClose, onCreate }: { onClose: () => void, onCreate: (title: string, desc: string, price: number) => void }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [accessMode, setAccessMode] = useState<'free' | 'paid'>(() => readDefaultPrice() > 0 ? 'paid' : 'free')
  const [price, setPrice] = useState(() => {
    const defaultPrice = readDefaultPrice()
    return defaultPrice > 0 ? defaultPrice.toFixed(2) : '4.99'
  })
  const parsedPrice = Math.max(0.5, Number(price) || 4.99)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated w-full max-w-md p-6 space-y-5 animate-slide-up">
        <div>
          <h2 className="text-text-primary font-bold text-lg">New Story</h2>
          <p className="text-text-secondary text-sm mt-1">Give your story a title and a brief description.</p>
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
          <div className="grid grid-cols-2 gap-3">
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
        <div className="flex gap-2 justify-end">
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
  const { loading: booksLoading, error: booksError, createBook, deleteBook, publishBook, duplicateBook } = useBooks()
  const { displayName } = useUser()
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')

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

  return (
    <>
      <Header>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Story
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* DB error banner */}
        {booksError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {booksError}
          </div>
        )}

        {/* Welcome */}
        <div>
          <h2 className="text-text-primary font-bold text-xl">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BookOpen} label="Total Stories" value={String(stories.length)} color="bg-accent/20 text-accent" />
          <StatCard icon={TrendingUp} label="Published" value={String(stories.filter((s: Story) => s.status === 'published').length)} color="bg-success/20 text-success" />
          <StatCard icon={Users} label="Est. Readers" value="—" sub="Awaiting launch" color="bg-info/20 text-info" />
          <StatCard icon={DollarSign} label="Revenue" value="—" sub="Awaiting launch" color="bg-gold/20 text-gold" />
        </div>

        {/* Filter tabs + stories */}
        <div className="space-y-4">
          <div className="flex items-center gap-1 border-b border-bg-border pb-3">
            {(['all', 'draft', 'published'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all',
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
        />
      )}
    </>
  )
}
