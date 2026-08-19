/**
 * lib/localImagesFs.ts
 * Server-only path helpers for the .casts/<slug>/ local image folders.
 * Import ONLY from route handlers (app/api/local-images/*) — this touches
 * Node's fs/path modules and must never end up in a client bundle.
 *
 * Layout convention (matches what the storybook-image-prompt /
 * scene-image-producer skills already write):
 *   .casts/<slug>/CHARACTER_REFS/<DisplayName>.{png,jpg,webp}  — portraits
 *   .casts/<slug>/images/ch<N>_sc<M>_*.{jpg,png,webp}          — scene images (flat, no subfolders)
 *   .casts/<slug>/cover.{jpg,png,webp}                         — book cover
 *
 * The dev server's cwd is apps/creator-studio (per package.json scripts), so
 * the repo's .casts/ folder is two levels up.
 */
import path from 'path'

const SLUG_RE = /^[a-z0-9-]+$/
export const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i

export function resolveCastDir(slug: string): string | null {
  if (!slug || !SLUG_RE.test(slug)) return null
  return path.resolve(process.cwd(), '..', '..', '.casts', slug)
}

/** Resolves a relative path against a cast dir, refusing anything that escapes it. */
export function resolveSafePath(castDir: string, relPath: string): string | null {
  if (!relPath || relPath.includes('\0')) return null
  const resolved = path.resolve(castDir, relPath)
  if (resolved !== castDir && !resolved.startsWith(castDir + path.sep)) return null
  return resolved
}

export function guessImageMime(p: string): string {
  if (/\.png$/i.test(p)) return 'image/png'
  if (/\.webp$/i.test(p)) return 'image/webp'
  return 'image/jpeg'
}
