'use client'
import { useRef, useState, useEffect } from 'react'
import {
  Music2, Wind, Upload, Play, Pause, Trash2,
  Volume1, Volume2, VolumeX, Loader2, AlertCircle, X, Image as ImageIcon,
  RotateCcw, MoveRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadSceneAudio, deleteSceneAudio, uploadSceneImage, deleteSceneImage } from '@/lib/supabase/storage'
import { updateSceneAtmosphere } from '@/lib/supabase/scenes'
import { useStudioStore } from '@/store/studioStore'
import { clsx } from 'clsx'
import type { Scene } from '@/types'

// ── Mini Audio Layer ──────────────────────────────────────────────────────────

interface AudioLayerProps {
  label:    string
  icon:     React.ReactNode
  url:      string | undefined
  volume:   number
  loop:     boolean
  storyId:  string
  chapterId: string
  sceneId:  string
  bookId:   string
  layer:    'ambience' | 'music'
  onUrlChange:    (url: string | undefined) => void
  onVolumeChange: (vol: number) => void
  onLoopChange:   (loop: boolean) => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

function AudioLayer({
  label, icon, url, volume, loop,
  storyId, chapterId, sceneId, bookId, layer,
  onUrlChange, onVolumeChange, onLoopChange,
}: AudioLayerProps) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [uploading,   setUploading]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [userId,      setUserId]      = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Tear down when url changes
  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current = null
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [url])

  // Keep loop setting in sync with live audio
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop
  }, [loop])

  const initAudio = () => {
    if (audioRef.current || !url) return
    const a = new Audio(url)
    a.loop              = loop
    a.volume            = volume
    a.onloadedmetadata  = () => setDuration(a.duration)
    a.ontimeupdate      = () => setCurrentTime(a.currentTime)
    audioRef.current    = a
  }

  const togglePlay = () => {
    if (!url) return
    initAudio()
    const a = audioRef.current!
    if (isPlaying) { a.pause(); setIsPlaying(false) }
    else           { a.play();  setIsPlaying(true)  }
  }

  // Keep live volume in sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    setError(null)
    const newUrl = await uploadSceneAudio(userId, bookId, sceneId, layer, file)
    if (newUrl) {
      onUrlChange(newUrl)
      await updateSceneAtmosphere(sceneId, layer === 'ambience' ? { ambienceUrl: newUrl } : { musicUrl: newUrl })
    } else {
      setError('Upload failed')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDelete = async () => {
    if (!userId || !url) return
    audioRef.current?.pause()
    setIsPlaying(false)
    await deleteSceneAudio(userId, bookId, sceneId, layer)
    onUrlChange(undefined)
    await updateSceneAtmosphere(sceneId, layer === 'ambience' ? { ambienceUrl: null } : { musicUrl: null })
  }

  const handleLoopToggle = async () => {
    const newLoop = !loop
    onLoopChange(newLoop)
    await updateSceneAtmosphere(
      sceneId,
      layer === 'ambience' ? { ambienceLoop: newLoop } : { musicLoop: newLoop }
    )
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div className="space-y-2">
      {/* Header with loop toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-muted">{icon}</span>
        <span className="text-text-secondary text-xs font-medium">{label}</span>
        {/* Loop toggle */}
        <button
          onClick={handleLoopToggle}
          title={loop ? 'Loops (click to disable)' : 'No loop (click to enable)'}
          className={clsx(
            'ml-auto flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors',
            loop
              ? 'border-accent/40 text-accent bg-accent/10 hover:bg-accent/20'
              : 'border-bg-border text-text-muted bg-bg-elevated hover:border-accent/30'
          )}
        >
          {loop
            ? <><RotateCcw size={8} /> loop</>
            : <><MoveRight size={8} /> once</>
          }
        </button>
      </div>

      {/* Upload / Player */}
      {!url && !uploading && (
        <>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
          <button
            className="btn-ghost w-full text-xs py-2 border border-dashed border-bg-border hover:border-accent/40 justify-center"
            onClick={() => fileRef.current?.click()}
            disabled={!userId}
          >
            <Upload size={11} /> Upload {label}
          </button>
          {error && <p className="text-danger text-[10px] flex items-center gap-1"><AlertCircle size={10}/> {error}</p>}
        </>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-xs text-text-secondary py-1">
          <Loader2 size={11} className="animate-spin text-accent" /> Uploading…
        </div>
      )}

      {url && !uploading && (
        <div className="space-y-2">
          {/* Mini player */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="w-6 h-6 rounded-full bg-accent/20 hover:bg-accent/30 flex items-center justify-center shrink-0 transition-colors"
            >
              {isPlaying
                ? <Pause size={9}  className="text-accent" />
                : <Play  size={9}  className="text-accent ml-0.5" />
              }
            </button>
            <div className="flex-1 h-1 bg-bg-border rounded-full overflow-hidden">
              <div className="h-full bg-accent/60 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-mono text-text-muted w-8 text-right shrink-0">
              {duration ? formatTime(duration) : '—'}
            </span>
            {/* Re-upload */}
            <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
            <button onClick={() => fileRef.current?.click()} className="text-text-muted hover:text-text-secondary transition-colors" title="Replace">
              <Upload size={10} />
            </button>
            {/* Delete */}
            <button onClick={handleDelete} className="text-text-muted hover:text-danger transition-colors" title="Remove">
              <Trash2 size={10} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <VolumeIcon size={10} className="text-text-muted shrink-0" />
            <input
              type="range" min="0" max="1" step="0.05"
              value={volume}
              onChange={e => onVolumeChange(parseFloat(e.target.value))}
              onPointerUp={async () => {
                await updateSceneAtmosphere(sceneId,
                  layer === 'ambience' ? { ambienceVolume: volume } : { musicVolume: volume }
                )
              }}
              className="flex-1 accent-accent h-1"
            />
            <span className="text-[10px] font-mono text-text-muted w-7 text-right shrink-0">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface SceneAtmospherePanelProps {
  scene:     Scene
  storyId:   string
  chapterId: string
  bookId:    string
  onClose:   () => void
}

export function SceneAtmospherePanel({
  scene, storyId, chapterId, bookId, onClose
}: SceneAtmospherePanelProps) {
  const updateScene = useStudioStore(s => s.updateScene)

  const [ambienceUrl,    setAmbienceUrl]    = useState(scene.ambienceUrl)
  const [musicUrl,       setMusicUrl]       = useState(scene.musicUrl)
  const [ambienceVolume, setAmbienceVolume] = useState(scene.ambienceVolume ?? 0.4)
  const [musicVolume,    setMusicVolume]    = useState(scene.musicVolume    ?? 0.3)
  const [ambienceLoop,   setAmbienceLoop]   = useState(scene.ambienceLoop   ?? true)
  const [musicLoop,      setMusicLoop]      = useState(scene.musicLoop      ?? true)
  const [sceneImage,     setSceneImage]     = useState<string | undefined>(scene.sceneImage)

  // Re-sync all state when the active scene changes
  useEffect(() => {
    setAmbienceUrl(scene.ambienceUrl)
    setMusicUrl(scene.musicUrl)
    setAmbienceVolume(scene.ambienceVolume ?? 0.4)
    setMusicVolume(scene.musicVolume ?? 0.3)
    setAmbienceLoop(scene.ambienceLoop ?? true)
    setMusicLoop(scene.musicLoop ?? true)
    setSceneImage(scene.sceneImage)
  }, [scene.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [imgUploading,   setImgUploading]   = useState(false)
  const [imgError,       setImgError]       = useState<string | null>(null)
  const [userId,         setUserId]         = useState<string | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setImgUploading(true)
    setImgError(null)
    const url = await uploadSceneImage(userId, bookId, scene.id, file)
    if (url) {
      setSceneImage(url)
      syncStore({ sceneImage: url })
      // Persist to DB so Vercel sees it too
      await updateSceneAtmosphere(scene.id, { sceneImage: url })
    } else {
      setImgError('Upload failed — check the covers bucket in Supabase.')
    }
    setImgUploading(false)
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  const handleImageDelete = async () => {
    if (!userId) return
    await deleteSceneImage(userId, bookId, scene.id)
    setSceneImage(undefined)
    syncStore({ sceneImage: undefined })
    await updateSceneAtmosphere(scene.id, { sceneImage: null })
  }

  // Keep store in sync
  const syncStore = (patch: Partial<Scene>) => {
    updateScene(storyId, chapterId, scene.id, patch)
  }

  const handleAmbienceUrl = (url: string | undefined) => {
    setAmbienceUrl(url)
    syncStore({ ambienceUrl: url })
  }
  const handleMusicUrl = (url: string | undefined) => {
    setMusicUrl(url)
    syncStore({ musicUrl: url })
  }
  const handleAmbienceVolume = (vol: number) => {
    setAmbienceVolume(vol)
    syncStore({ ambienceVolume: vol })
  }
  const handleMusicVolume = (vol: number) => {
    setMusicVolume(vol)
    syncStore({ musicVolume: vol })
  }
  const handleAmbienceLoop = (loop: boolean) => {
    setAmbienceLoop(loop)
    syncStore({ ambienceLoop: loop })
  }
  const handleMusicLoop = (loop: boolean) => {
    setMusicLoop(loop)
    syncStore({ musicLoop: loop })
  }

  return (
    <aside className="w-60 shrink-0 border-l border-bg-border bg-bg-secondary overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-bg-border shrink-0">
        <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Scene Atmosphere</span>
        <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">

        {/* Scene name */}
        <p className="text-text-secondary text-xs font-medium truncate">{scene.title}</p>

        {/* ── Ambience ── */}
        <div className="space-y-2">
          <AudioLayer
            label="Ambience"
            icon={<Wind size={12} />}
            url={ambienceUrl}
            volume={ambienceVolume}
            loop={ambienceLoop}
            storyId={storyId}
            chapterId={chapterId}
            sceneId={scene.id}
            bookId={bookId}
            layer="ambience"
            onUrlChange={handleAmbienceUrl}
            onVolumeChange={handleAmbienceVolume}
            onLoopChange={handleAmbienceLoop}
          />
        </div>

        <div className="border-t border-bg-border/50" />

        {/* ── Music ── */}
        <div className="space-y-2">
          <AudioLayer
            label="Music"
            icon={<Music2 size={12} />}
            url={musicUrl}
            volume={musicVolume}
            loop={musicLoop}
            storyId={storyId}
            chapterId={chapterId}
            sceneId={scene.id}
            bookId={bookId}
            layer="music"
            onUrlChange={handleMusicUrl}
            onVolumeChange={handleMusicVolume}
            onLoopChange={handleMusicLoop}
          />
        </div>

        <div className="border-t border-bg-border/50" />

        {/* ── Scene Image ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ImageIcon size={12} className="text-text-muted" />
            <span className="text-text-secondary text-xs font-medium">Scene Image</span>
          </div>

          {sceneImage ? (
            <div className="relative rounded-lg overflow-hidden border border-bg-border group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sceneImage} alt="Scene" className="w-full h-28 object-cover" />
              <button
                onClick={handleImageDelete}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/80"
                title="Remove image"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ) : imgUploading ? (
            <div className="flex items-center gap-2 text-xs text-text-muted py-2">
              <Loader2 size={12} className="animate-spin text-accent" /> Uploading…
            </div>
          ) : (
            <>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                className="btn-ghost w-full text-xs py-2 border border-dashed border-bg-border hover:border-accent/40 justify-center"
                onClick={() => imgInputRef.current?.click()}
                disabled={!userId}
              >
                <Upload size={11} /> Upload image
              </button>
            </>
          )}

          {imgError && (
            <p className="text-danger text-[10px] flex items-center gap-1">
              <AlertCircle size={10} /> {imgError}
            </p>
          )}
          <p className="text-[10px] text-text-muted">JPG / PNG / WebP · shown behind scene in reader</p>
        </div>

        <div className="border-t border-bg-border/50" />

        {/* ── Beat Summary ── */}
        <div className="space-y-1.5">
          <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Beat Summary</p>
          {(['narration', 'dialogue', 'thought', 'quote', 'pause', 'sfx'] as const).map(type => {
            const count = scene.blocks.filter(b => b.type === type).length
            if (!count) return null
            return (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="text-text-muted capitalize">{type}</span>
                <span className="text-text-secondary font-medium">{count}</span>
              </div>
            )
          })}
          {scene.blocks.length === 0 && (
            <p className="text-text-muted text-xs">No beats yet</p>
          )}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-bg-border/50">
            <span className="text-text-muted">Total blocks</span>
            <span className="text-text-primary font-semibold">{scene.blocks.length}</span>
          </div>
        </div>

        {/* Atmosphere status chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full border',
            ambienceUrl ? 'bg-success/10 text-success border-success/20' : 'bg-bg-elevated text-text-muted border-bg-border'
          )}>
            {ambienceUrl ? '✓ Ambience' : '○ No ambience'}
          </span>
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full border',
            musicUrl ? 'bg-success/10 text-success border-success/20' : 'bg-bg-elevated text-text-muted border-bg-border'
          )}>
            {musicUrl ? '✓ Music' : '○ No music'}
          </span>
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full border',
            sceneImage ? 'bg-success/10 text-success border-success/20' : 'bg-bg-elevated text-text-muted border-bg-border'
          )}>
            {sceneImage ? '✓ Image' : '○ No image'}
          </span>
        </div>
      </div>
    </aside>
  )
}
