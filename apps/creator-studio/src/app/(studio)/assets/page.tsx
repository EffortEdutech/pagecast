'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStudioStore } from '@/store/studioStore'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import {
  AlertCircle,
  BookOpen,
  FileAudio,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react'
import { clsx } from 'clsx'

type AssetType = 'voice' | 'sfx' | 'music' | 'image' | 'other'
type FilterType = AssetType | 'all'

interface Asset {
  name: string
  label: string
  type: AssetType
  sizeBytes: number
  bucket: 'assets' | 'covers'
  publicUrl: string
  bookTitle?: string
  detail?: string
}

interface BlockAssetMeta {
  type: string
  label: string
  detail: string
}

const TYPE_META: Record<AssetType, { icon: React.ElementType; label: string; color: string }> = {
  voice: { icon: Mic, label: 'Voice', color: 'text-accent' },
  sfx: { icon: Volume2, label: 'SFX', color: 'text-success' },
  music: { icon: Music, label: 'Music', color: 'text-info' },
  image: { icon: ImageIcon, label: 'Image', color: 'text-gold' },
  other: { icon: FileAudio, label: 'Audio', color: 'text-text-secondary' },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\.[^.]+$/, '')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function guessType(name: string, blockMeta?: BlockAssetMeta): AssetType {
  if (blockMeta?.type === 'sfx') return 'sfx'
  if (blockMeta && ['narration', 'dialogue', 'thought', 'quote'].includes(blockMeta.type)) return 'voice'
  if (name.startsWith('scene_') && name.includes('_image')) return 'image'
  if (name.startsWith('scene_') && (name.includes('_ambience') || name.includes('_music'))) return 'music'
  if (name.startsWith('sfx_')) return 'sfx'

  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'other'
  return 'voice'
}

function prettyLabel(name: string, blockMeta?: BlockAssetMeta): string {
  if (blockMeta) return blockMeta.label
  if (name.startsWith('scene_') && name.includes('_ambience')) {
    return `Ambience: ${name.replace('scene_', '').replace('_ambience', '').slice(0, 8)}...`
  }
  if (name.startsWith('scene_') && name.includes('_music')) {
    return `Music: ${name.replace('scene_', '').replace('_music', '').slice(0, 8)}...`
  }
  if (name.startsWith('scene_') && name.includes('_image')) {
    return `Image: ${name.replace('scene_', '').replace('_image', '').slice(0, 8)}...`
  }
  if (name.startsWith('sfx_')) return titleCase(name.replace(/^sfx_\d+_?/, ''))
  return `Block: ${name.slice(0, 12)}...`
}

function assetSearchText(asset: Asset): string {
  return [asset.label, asset.detail, asset.bookTitle, asset.name].filter(Boolean).join(' ').toLowerCase()
}

function AssetRow({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const { icon: Icon, color } = TYPE_META[asset.type]

  const toggle = () => {
    if (asset.type === 'image') return
    if (!audioRef.current) {
      audioRef.current = new Audio(asset.publicUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <tr className="group hover:bg-bg-elevated/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center shrink-0">
            <Icon size={15} className={color} />
          </div>
          <div className="min-w-0">
            <span className="text-text-primary text-sm font-medium truncate block max-w-[280px]">
              {asset.label}
            </span>
            <span className="text-text-muted text-[11px] truncate block max-w-[340px]">
              {asset.detail ?? asset.name}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-bg-elevated', color)}>
          {TYPE_META[asset.type].label}
        </span>
      </td>
      <td className="px-4 py-3 text-text-muted text-xs">{asset.bookTitle ?? 'Unknown book'}</td>
      <td className="px-4 py-3 text-text-muted text-xs">{formatBytes(asset.sizeBytes)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {asset.type !== 'image' ? (
            <button
              type="button"
              onClick={toggle}
              className="w-7 h-7 rounded-full bg-accent/20 hover:bg-accent/35 flex items-center justify-center text-accent transition-colors"
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={10} /> : <Play size={10} className="ml-0.5" />}
            </button>
          ) : (
            <a
              href={asset.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-text-muted hover:text-accent transition-colors px-2"
            >
              View
            </a>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-danger transition-colors"
            title="Delete asset"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function AssetsPage() {
  const stories = useStudioStore(s => s.stories)
  const activeStoryId = useStudioStore(s => s.activeStoryId)
  const [bookId, setBookId] = useState(() =>
    activeStoryId && /^[0-9a-f-]{36}$/.test(activeStoryId) ? activeStoryId : 'all'
  )
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploadingSfx, setUploadingSfx] = useState(false)
  const sfxInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (bookId !== 'all') return
    if (activeStoryId && /^[0-9a-f-]{36}$/.test(activeStoryId)) {
      setBookId(activeStoryId)
      return
    }
    const firstRealBook = stories.find(story => /^[0-9a-f-]{36}$/.test(story.id))
    if (firstRealBook) setBookId(firstRealBook.id)
  }, [activeStoryId, bookId, stories])

  const loadAssets = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const result: Asset[] = []
    const bookIds = bookId === 'all'
      ? stories.map(s => s.id).filter(id => /^[0-9a-f-]{36}$/.test(id))
      : [bookId]
    const bookTitleById = new Map(stories.map(s => [s.id, s.title]))

    try {
      for (const bid of bookIds) {
        const { data: blocks } = await supabase
          .from('blocks')
          .select('id,type,content')
          .eq('book_id', bid)

        const blockMeta = new Map<string, BlockAssetMeta>()
        for (const block of blocks ?? []) {
          const content = (block.content ?? {}) as Record<string, unknown>
          const text = String(content.text ?? '').trim()
          const blockType = String(block.type)
          const label = blockType === 'sfx'
            ? `SFX: ${String(content.label ?? 'Sound effect')}`
            : `${titleCase(blockType)} voice`

          blockMeta.set(String(block.id), {
            type: blockType,
            label,
            detail: text ? text.slice(0, 100) : bookTitleById.get(bid) ?? bid,
          })
        }

        const { data: files, error: assetsError } = await supabase.storage
          .from('assets')
          .list(`${userId}/${bid}`, { limit: 300 })

        if (assetsError) throw assetsError

        for (const file of files ?? []) {
          const path = `${userId}/${bid}/${file.name}`
          const meta = blockMeta.get(file.name)
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          result.push({
            name: path,
            label: prettyLabel(file.name, meta),
            type: guessType(file.name, meta),
            sizeBytes: file.metadata?.size ?? 0,
            bucket: 'assets',
            publicUrl: urlData.publicUrl,
            bookTitle: bookTitleById.get(bid),
            detail: meta?.detail ?? (file.name.startsWith('sfx_') ? 'Standalone SFX file' : undefined),
          })
        }

        const { data: images, error: coversError } = await supabase.storage
          .from('covers')
          .list(`${userId}/${bid}`, { limit: 150 })

        if (coversError) throw coversError

        for (const file of images ?? []) {
          const path = `${userId}/${bid}/${file.name}`
          const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path)
          result.push({
            name: path,
            label: prettyLabel(file.name),
            type: 'image',
            sizeBytes: file.metadata?.size ?? 0,
            bucket: 'covers',
            publicUrl: urlData.publicUrl,
            bookTitle: bookTitleById.get(bid),
            detail: 'Scene image',
          })
        }
      }

      setAssets(result.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label)))
    } catch (e: any) {
      setError(e.message ?? 'Could not load assets.')
    } finally {
      setLoading(false)
    }
  }, [userId, bookId, stories])

  useEffect(() => { loadAssets() }, [loadAssets])

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.label}"?`)) return
    const supabase = createClient()
    const { error: deleteError } = await supabase.storage.from(asset.bucket).remove([asset.name])
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setAssets(prev => prev.filter(a => a.name !== asset.name))
  }

  const handleSfxUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !userId || bookId === 'all') return

    setUploadingSfx(true)
    setError(null)

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
    const path = `${userId}/${bookId}/sfx_${Date.now()}_${safeName}`
    const supabase = createClient()
    const { error: uploadError } = await supabase.storage.from('assets').upload(path, file, {
      upsert: false,
      contentType: file.type || 'audio/mpeg',
    })

    if (uploadError) setError(uploadError.message)
    await loadAssets()
    setUploadingSfx(false)
    if (sfxInputRef.current) sfxInputRef.current.value = ''
  }

  const filtered = assets
    .filter(asset => filter === 'all' || asset.type === filter)
    .filter(asset => !search.trim() || assetSearchText(asset).includes(search.trim().toLowerCase()))

  const totalSize = assets.reduce((sum, asset) => sum + asset.sizeBytes, 0)
  const counts = assets.reduce<Record<AssetType, number>>((acc, asset) => {
    acc[asset.type] += 1
    return acc
  }, { voice: 0, sfx: 0, music: 0, image: 0, other: 0 })

  return (
    <>
      <Header title="Asset Manager">
        <button type="button" onClick={loadAssets} className="btn-ghost text-xs px-2 py-1.5" title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </Header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="rounded-lg border border-bg-border bg-bg-card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-text-muted" />
              <select className="input text-sm py-1 pr-8" value={bookId} onChange={e => setBookId(e.target.value)}>
                <option value="all">All books</option>
                {stories.map(story => (
                  <option key={story.id} value={story.id}>{story.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-text-muted text-xs">
              <HardDrive size={13} />
              {assets.length} file{assets.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <input ref={sfxInputRef} type="file" accept="audio/*" className="hidden" onChange={handleSfxUpload} />
              <button
                type="button"
                onClick={() => sfxInputRef.current?.click()}
                disabled={bookId === 'all' || uploadingSfx}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
                title={bookId === 'all' ? 'Choose one book before uploading SFX' : 'Upload SFX audio'}
              >
                {uploadingSfx ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Upload SFX
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap mt-4">
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'voice', 'sfx', 'music', 'image', 'other'] as FilterType[]).map(type => {
                const meta = type === 'all'
                  ? { icon: FolderOpen, label: 'All', color: 'text-text-secondary' }
                  : TYPE_META[type]
                const Icon = meta.icon
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilter(type)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                      filter === type
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    <Icon size={13} className={filter === type ? 'text-accent' : meta.color} />
                    <span>{meta.label}</span>
                    <span className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      filter === type ? 'bg-accent/20 text-accent' : 'bg-bg-card text-text-muted'
                    )}>
                      {type === 'all' ? assets.length : counts[type]}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex-1 max-w-sm relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                className="input pl-8 text-sm"
                placeholder="Search assets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading assets from storage...
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
              Generate voices, choose SFX from the editor, upload SFX here, or add scene images in the Atmosphere panel.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-4 py-3 text-text-muted text-[10px] font-semibold uppercase tracking-wide">Asset</th>
                  <th className="text-left px-4 py-3 text-text-muted text-[10px] font-semibold uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-text-muted text-[10px] font-semibold uppercase tracking-wide">Book</th>
                  <th className="text-left px-4 py-3 text-text-muted text-[10px] font-semibold uppercase tracking-wide">Size</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {filtered.map(asset => (
                  <AssetRow key={asset.name} asset={asset} onDelete={() => handleDelete(asset)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
