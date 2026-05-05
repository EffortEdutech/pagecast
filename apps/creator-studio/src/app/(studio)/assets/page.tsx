'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStudioStore } from '@/store/studioStore'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import {
  Music, Volume2, Image as ImageIcon, Upload, FileAudio,
  Trash2, Search, Play, Pause, Loader2, AlertCircle,
  RefreshCw, BookOpen, Mic
} from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetType = 'voice' | 'music' | 'image' | 'other'

interface Asset {
  name:      string   // storage path
  label:     string   // display name
  type:      AssetType
  sizeBytes: number
  bucket:    'assets' | 'covers'
  publicUrl: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guessType(name: string): AssetType {
  if (name.includes('scene_') && name.includes('_image')) return 'image'
  if (name.includes('scene_') && (name.includes('_ambience') || name.includes('_music'))) return 'music'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'other'
  return 'voice'  // bare block IDs → voice recordings
}

function prettyLabel(path: string): string {
  const seg = path.split('/').pop() ?? path
  if (seg.startsWith('scene_') && seg.includes('_ambience')) return `Ambience: ${seg.replace('scene_', '').replace('_ambience', '').slice(0, 8)}…`
  if (seg.startsWith('scene_') && seg.includes('_music'))    return `Music: ${seg.replace('scene_', '').replace('_music', '').slice(0, 8)}…`
  if (seg.startsWith('scene_') && seg.includes('_image'))    return `Image: ${seg.replace('scene_', '').replace('_image', '').slice(0, 8)}…`
  return `Block: ${seg.slice(0, 12)}…`
}

function formatBytes(b: number): string {
  if (b < 1024)         return `${b} B`
  if (b < 1024 * 1024)  return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const TYPE_META: Record<AssetType, { icon: React.ElementType; label: string; color: string }> = {
  voice: { icon: Mic,       label: 'Voice',  color: 'text-accent' },
  music: { icon: Music,     label: 'Music',  color: 'text-info' },
  image: { icon: ImageIcon, label: 'Image',  color: 'text-gold' },
  other: { icon: Volume2,   label: 'Audio',  color: 'text-success' },
}

// ─── Mini audio row ───────────────────────────────────────────────────────────

function AudioRow({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const toggle = () => {
    if (asset.type === 'image') return
    if (!audioRef.current) {
      audioRef.current = new Audio(asset.publicUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else         { audioRef.current.play();  setPlaying(true)  }
  }

  const { icon: Icon, color } = TYPE_META[asset.type]

  return (
    <tr className="hover:bg-bg-elevated/50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Icon size={13} className={color} />
          <span className="text-text-primary text-sm font-medium truncate max-w-[180px]">{asset.label}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={clsx('text-xs font-medium', color)}>{TYPE_META[asset.type].label}</span>
      </td>
      <td className="px-4 py-3 text-text-muted text-xs">{formatBytes(asset.sizeBytes)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {asset.type !== 'image' && (
            <button
              onClick={toggle}
              className="w-6 h-6 rounded-full bg-accent/20 hover:bg-accent/40 flex items-center justify-center text-accent transition-colors"
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={9} /> : <Play size={9} className="ml-0.5" />}
            </button>
          )}
          {asset.type === 'image' && (
            <a href={asset.publicUrl} target="_blank" rel="noreferrer"
              className="text-[10px] text-text-muted hover:text-accent transition-colors px-1">
              View
            </a>
          )}
          <button
            onClick={onDelete}
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-danger transition-colors"
            title="Delete asset"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterType = AssetType | 'all'

export default function AssetsPage() {
  const stories  = useStudioStore(s => s.stories)
  const [bookId,   setBookId]   = useState<string>('all')
  const [filter,   setFilter]   = useState<FilterType>('all')
  const [search,   setSearch]   = useState('')
  const [assets,   setAssets]   = useState<Asset[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [userId,   setUserId]   = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const loadAssets = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const result: Asset[] = []

    // Determine book IDs to query
    const bookIds = bookId === 'all'
      ? stories.map(s => s.id).filter(id => /^[0-9a-f-]{36}$/.test(id))
      : [bookId]

    for (const bid of bookIds) {
      // ── assets bucket (voice + scene audio) ──
      const { data: files } = await supabase.storage
        .from('assets')
        .list(`${userId}/${bid}`, { limit: 200 })

      for (const f of files ?? []) {
        const path = `${userId}/${bid}/${f.name}`
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
        result.push({
          name:      path,
          label:     prettyLabel(f.name),
          type:      guessType(f.name),
          sizeBytes: f.metadata?.size ?? 0,
          bucket:    'assets',
          publicUrl: urlData.publicUrl,
        })
      }

      // ── covers bucket (scene images) ──
      const { data: imgs } = await supabase.storage
        .from('covers')
        .list(`${userId}/${bid}`, { limit: 100 })

      for (const f of imgs ?? []) {
        const path = `${userId}/${bid}/${f.name}`
        const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path)
        result.push({
          name:      path,
          label:     prettyLabel(f.name),
          type:      'image',
          sizeBytes: f.metadata?.size ?? 0,
          bucket:    'covers',
          publicUrl: urlData.publicUrl,
        })
      }
    }

    setAssets(result)
    setLoading(false)
  }, [userId, bookId, stories])

  useEffect(() => { loadAssets() }, [loadAssets])

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.label}"?`)) return
    setDeleting(asset.name)
    const supabase = createClient()
    await supabase.storage.from(asset.bucket).remove([asset.name])
    setAssets(prev => prev.filter(a => a.name !== asset.name))
    setDeleting(null)
  }

  const filtered = assets
    .filter(a => filter === 'all' || a.type === filter)
    .filter(a => search === '' || a.label.toLowerCase().includes(search.toLowerCase()))

  const totalSize = assets.reduce((acc, a) => acc + a.sizeBytes, 0)

  return (
    <>
      <Header title="Asset Manager">
        <button onClick={loadAssets} className="btn-ghost text-xs px-2 py-1.5" title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </Header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Book selector + stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-text-muted" />
            <select
              className="input text-sm py-1 pr-8"
              value={bookId}
              onChange={e => setBookId(e.target.value)}
            >
              <option value="all">All books</option>
              {stories.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          {!loading && assets.length > 0 && (
            <span className="text-text-muted text-xs">
              {assets.length} file{assets.length !== 1 ? 's' : ''} · {formatBytes(totalSize)} total
            </span>
          )}
        </div>

        {/* Type filter + search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {(['all', 'voice', 'music', 'image', 'other'] as FilterType[]).map(type => {
              const meta = type === 'all' ? { icon: FileAudio, label: 'All', color: 'text-text-secondary' } : TYPE_META[type as AssetType]
              const Icon = meta.icon
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    filter === type
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  )}
                >
                  <Icon size={13} className={filter === type ? 'text-accent' : meta.color} />
                  {meta.label}
                </button>
              )
            })}
          </div>
          <div className="flex-1 max-w-xs relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              className="input pl-8 text-sm"
              placeholder="Search assets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading assets from storage…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-danger text-sm py-8 justify-center">
            <AlertCircle size={16} /> {error}
          </div>
        ) : !userId ? (
          <p className="text-text-muted text-sm text-center py-8">Sign in to view your assets.</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FileAudio size={36} className="text-text-muted/40 mx-auto" />
            <p className="text-text-secondary text-sm">No assets yet.</p>
            <p className="text-text-muted text-xs">
              Upload audio files in the Story Editor, or add scene images in the Atmosphere Panel.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-4 py-3 text-text-muted text-[10px] font-semibold uppercase tracking-wide">Asset</th>
                  <th className="text-left px-4 py-3 text-text-muted text-[10px] font-semibold uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-text-muted text-[10px] font-semibold uppercase tracking-wide">Size</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {filtered.map(asset => (
                  <AudioRow
                    key={asset.name}
                    asset={asset}
                    onDelete={() => handleDelete(asset)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </>
  )
}
