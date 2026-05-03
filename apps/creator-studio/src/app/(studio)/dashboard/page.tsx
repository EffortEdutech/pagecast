'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudioStore } from '@/store/studioStore'
import { Header } from '@/components/layout/Header'
import {
  Plus, BookOpen, Clock, Music, Mic, MoreVertical,
  Edit3, Trash2, Eye, Copy, TrendingUp, Users, DollarSign
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

function StoryCard({ story, onEdit, onDelete, onDuplicate }: {
  story: Story
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const coverColors = ['from-accent/30 to-accent/10', 'from-gold/30 to-gold/10', 'from-info/30 to-info/10', 'from-success/30 to-success/10']
  const colorIdx = story.id.charCodeAt(story.id.length - 1) % coverColors.length

  return (
    <div className="card hover:border-accent/30 transition-all duration-200 overflow-hidden group">
      {/* Cover */}
      <div className={clsx('h-32 bg-gradient-to-br flex items-center justify-center relative', coverColors[colorIdx])}>
        <BookOpen size={36} className="text-white/20" />
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className={clsx(
            story.status === 'published' ? 'badge-published' :
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
          <button className="btn-secondary text-xs px-3 py-1.5">
            <Eye size={13} /> Preview
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
              <div className="absolute right-0 top-7 z-20 card-elevated w-36 py-1 text-xs animate-fade-in">
                <button onClick={() => { onEdit(); setMenuOpen(false) }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
                  <Edit3 size={12} /> Continue editing
                </button>
                <button onClick={() => { onDuplicate(); setMenuOpen(false) }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
                  <Copy size={12} /> Duplicate
                </button>
                <div className="my-1 border-t border-bg-border" />
                <button onClick={() => { onDelete(); setMenuOpen(false) }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-danger/10 text-text-muted hover:text-danger transition-colors">
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

function NewStoryModal({ onClose, onCreate }: { onClose: () => void, onCreate: (title: string, desc: string) => void }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

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
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!title.trim()}
            onClick={() => { if (title.trim()) onCreate(title.trim(), desc.trim()) }}
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
  const { stories, createStory, deleteStory, updateStory, setActiveStory, creator } = useStudioStore()
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')

  const filtered = stories.filter(s => filter === 'all' || s.status === filter)

  const handleCreate = (title: string, desc: string) => {
    const story = createStory(title, desc)
    setShowModal(false)
    setActiveStory(story.id)
    router.push(`/studio/${story.id}`)
  }

  const handleEdit = (story: Story) => {
    setActiveStory(story.id)
    router.push(`/studio/${story.id}`)
  }

  const handleDuplicate = (story: Story) => {
    createStory(`${story.title} (copy)`, story.description)
  }

  return (
    <>
      <Header>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Story
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-text-primary font-bold text-xl">
            Welcome back, {creator?.name ?? 'Creator'} 👋
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
          <StatCard icon={TrendingUp} label="Published" value={String(stories.filter(s => s.status === 'published').length)} color="bg-success/20 text-success" />
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
                  {f === 'all' ? stories.length : stories.filter(s => s.status === f).length}
                </span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <BookOpen size={40} className="text-text-muted mx-auto" />
              <p className="text-text-secondary">No stories here yet.</p>
              <button className="btn-primary mx-auto" onClick={() => setShowModal(true)}>
                <Plus size={15} /> Create your first story
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onEdit={() => handleEdit(story)}
                  onDelete={() => deleteStory(story.id)}
                  onDuplicate={() => handleDuplicate(story)}
                />
              ))}
              {/* Add new card */}
              <button
                onClick={() => setShowModal(true)}
                className="card border-dashed border-bg-border hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 h-full min-h-[220px] flex flex-col items-center justify-center gap-3 text-text-muted hover:text-accent group"
              >
                <div className="w-12 h-12 rounded-xl border-2 border-dashed border-current flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus size={20} />
                </div>
                <span className="text-sm font-medium">New Story</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {showModal && <NewStoryModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </>
  )
}
