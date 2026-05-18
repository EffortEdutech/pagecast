'use client'

import Link from 'next/link'
import { BookmarkCheck, Library, X } from 'lucide-react'

interface GuestConversionPromptProps {
  storyId: string
  open: boolean
  onClose: () => void
  reason?: 'progress' | 'save' | 'finish'
}

export function GuestConversionPrompt({ storyId, open, onClose, reason = 'progress' }: GuestConversionPromptProps) {
  if (!open) return null

  const copy = reason === 'finish'
    ? {
      title: 'Keep the next Cast waiting for you',
      body: 'Create a free PageCast account to save this Journey, unlock more Tales, and return to your place anytime.',
    }
    : reason === 'save'
      ? {
        title: 'Save this Cast to My Casts',
        body: 'A free account lets PageCast remember your progress, bookmarks, and unlocked Casts across devices.',
      }
      : {
        title: 'Enjoying the Cast?',
        body: 'Create a free account to keep your place and open more Casts after your guest shelf.',
      }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 px-4">
      <section className="card-elevated w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-text-primary font-semibold">{copy.title}</h2>
            <p className="text-text-secondary text-sm leading-relaxed mt-2">{copy.body}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary">
          <div className="rounded-lg bg-bg-elevated border border-bg-border p-3">
            <BookmarkCheck size={15} className="text-success mb-2" />
            Save progress
          </div>
          <div className="rounded-lg bg-bg-elevated border border-bg-border p-3">
            <Library size={15} className="text-accent mb-2" />
            Build My Casts
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/login?next=/reader/${storyId}`} className="btn-primary flex-1 justify-center">
            Create free account
          </Link>
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Maybe later
          </button>
        </div>
      </section>
    </div>
  )
}
