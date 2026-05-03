'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Music, Volume2, Image as ImageIcon, Upload, FileAudio, Trash2, Search } from 'lucide-react'
import { clsx } from 'clsx'

type AssetType = 'music' | 'sfx' | 'image'

const DEMO_ASSETS = [
  { id: '1', name: 'forest-night.mp3', type: 'music' as AssetType, size: '2.4 MB', duration: '3:12' },
  { id: '2', name: 'mystery.mp3',      type: 'music' as AssetType, size: '1.8 MB', duration: '2:45' },
  { id: '3', name: 'adventure.mp3',    type: 'music' as AssetType, size: '3.1 MB', duration: '4:05' },
  { id: '4', name: 'branch_snap.mp3',  type: 'sfx' as AssetType,   size: '48 KB',  duration: '0:02' },
  { id: '5', name: 'door_creak.mp3',   type: 'sfx' as AssetType,   size: '62 KB',  duration: '0:03' },
  { id: '6', name: 'thunder.mp3',      type: 'sfx' as AssetType,   size: '120 KB', duration: '0:05' },
  { id: '7', name: 'cover-forest.jpg', type: 'image' as AssetType, size: '380 KB', duration: '' },
]

const TAB_META: Record<AssetType | 'all', { icon: any; label: string; color: string }> = {
  all:   { icon: FileAudio,  label: 'All',   color: 'text-text-secondary' },
  music: { icon: Music,      label: 'Music', color: 'text-accent' },
  sfx:   { icon: Volume2,    label: 'SFX',   color: 'text-success' },
  image: { icon: ImageIcon,  label: 'Images',color: 'text-gold' },
}

export default function AssetsPage() {
  const [filter, setFilter] = useState<AssetType | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = DEMO_ASSETS
    .filter(a => filter === 'all' || a.type === filter)
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <Header title="Asset Manager">
        <label className="btn-primary cursor-pointer">
          <Upload size={15} /> Upload Asset
          <input type="file" className="hidden" accept="audio/*,image/*" multiple />
        </label>
      </Header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {(Object.keys(TAB_META) as (AssetType | 'all')[]).map(type => {
              const { icon: Icon, label, color } = TAB_META[type]
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    filter === type ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  )}
                >
                  <Icon size={13} className={filter === type ? 'text-accent' : color} />
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex-1 max-w-xs relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input className="input pl-8 text-sm" placeholder="Search assets…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Drop zone */}
        <div className="border-2 border-dashed border-bg-border rounded-xl p-8 text-center hover:border-accent/40 hover:bg-accent/5 transition-all cursor-pointer group">
          <Upload size={28} className="text-text-muted group-hover:text-accent mx-auto mb-2 transition-colors" />
          <p className="text-text-secondary text-sm">Drop audio or image files here to upload</p>
          <p className="text-text-muted text-xs mt-1">Supports MP3, WAV, OGG, JPG, PNG</p>
        </div>

        {/* Asset list */}
        {filtered.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No assets found.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="text-left px-4 py-3 text-text-muted text-xs font-medium uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-text-muted text-xs font-medium uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-text-muted text-xs font-medium uppercase tracking-wide">Size</th>
                  <th className="text-left px-4 py-3 text-text-muted text-xs font-medium uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {filtered.map(asset => {
                  const { icon: Icon, color } = TAB_META[asset.type]
                  return (
                    <tr key={asset.id} className="hover:bg-bg-elevated/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Icon size={14} className={color} />
                          <span className="text-text-primary font-medium">{asset.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-text-secondary">{asset.type}</td>
                      <td className="px-4 py-3 text-text-muted text-xs">{asset.size}</td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">{asset.duration || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-text-muted hover:text-danger transition-colors p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
