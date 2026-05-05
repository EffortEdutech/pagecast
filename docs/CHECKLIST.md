# PageCast — Development Progress Checklist
> Derived from `pagecast-documentation.md` · Updated as we build
>
> **Legend:** ✅ Done · 🔧 Partial · ⬜ Not started · 🚫 Post-MVP (roadmap)

---

## SPRINT 0 — Infrastructure & Monorepo

### 0a · Version Control & Repository

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | GitHub repo created (EffortEdutech/pagecast) | ✅ | https://github.com/EffortEdutech/pagecast |
| 0.2 | `.gitignore` configured (node_modules, .next, .env, build) | ✅ | Root-level, covers all apps |
| 0.3 | Initial commit & push to `main` | ✅ | All sprints committed and pushed |
| 0.4 | Branch strategy set (`main` = production, `dev` = active work) | ⬜ | Create `dev` branch after first push |
| 0.5 | GitHub branch protection on `main` (no direct push) | ⬜ | Settings → Branches → Add rule |
| 0.6 | Commit message convention agreed (`feat:` `fix:` `chore:`) | ✅ | Using conventional commits |

### 0b · Codebase Scaffold

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.7 | Monorepo root (`/pageCast`) with shared packages | ✅ | `apps/`, `packages/`, root `package.json` |
| 0.8 | Reader App scaffolded (Next.js, port 3800) | ✅ | `apps/reader-app` |
| 0.9 | Creator Studio scaffolded (Next.js, port 3801) | ✅ | `apps/creator-studio` |
| 0.10 | Shared TypeScript types package | ✅ | `packages/types` or `src/types/index.ts` |
| 0.11 | Tailwind + design token system (dark theme) | ✅ | `tailwind.config.ts`, `globals.css` |

### 0c · External Services Setup

| # | Service | Status | Needed For | Notes |
|---|---------|--------|-----------|-------|
| 0.12 | **GitHub** | ✅ | Version control | https://github.com/EffortEdutech/pagecast |
| 0.13 | **Supabase** — project created | ✅ | Auth + Database | Project ID: `zdlbcvscytujdomxzwei` |
| 0.14 | **Supabase** — database schema migrated | ✅ | Sprint 1+ | `docs/supabase-schema.sql` applied; all tables live |
| 0.15 | **Cloudflare R2** — bucket created (`pagecast-assets`) | ⚠️ | Audio upload (Sprint 4) | Account ready · bucket blocked (requires credit card) |
| 0.16 | **Cloudflare R2** — CORS policy set | ⬜ | Audio upload | Allow PUT from Vercel domains · do after bucket created |
| 0.17 | **Stripe** — account created | ⬜ | Payments (Sprint 6) | Setup after Render is live |
| 0.18 | **Stripe** — webhook endpoint registered | ⬜ | Sprint 6 | Point to `https://<render-url>/webhooks/stripe` |
| 0.19 | **Render** — NestJS backend service created | ⬜ | Sprint 4+ | Not needed for Sprints 1–3 · set up when backend is scaffolded |
| 0.19a | **Render** — health check endpoint (`GET /health`) | ⬜ | Keep-alive | Returns `{ status: "ok", timestamp }` — used by cron ping |
| 0.19b | **cron-job.org** — ping job created | ⬜ | Prevent Render sleep | Ping `https://<render-url>/health` every 5 min · free at cron-job.org |
| 0.20 | **Vercel** — reader-app deployed | ✅ | Audience access | https://pagecast-nine.vercel.app |
| 0.21 | **Vercel** — creator-studio deployed | ✅ | Creator access | https://pagecast-studio.vercel.app |

### 0d · Environment Variables

> Create `.env.local` in each app (never committed). Add these as you set up each service.

**`apps/reader-app/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=https://zdlbcvscytujdomxzwei.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — see external_services.txt>
NEXT_PUBLIC_API_URL=          # Render backend URL — fill when Render is live
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=# Fill when Stripe is set up
```

**`apps/creator-studio/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=https://zdlbcvscytujdomxzwei.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — see external_services.txt>
SUPABASE_SERVICE_ROLE_KEY=    # Service role key — see external_services.txt
NEXT_PUBLIC_API_URL=          # Render backend URL — fill when Render is live
```

---

## SPRINT 1 — Authentication System

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Sign up page | ✅ | Reader app: tabs for sign-in / sign-up |
| 1.2 | Login page | ✅ | Both apps: Supabase `signInWithPassword` |
| 1.3 | User role selection (reader / creator) | 🔧 | Separate apps serve as role gate |
| 1.4 | Supabase Auth integration | ✅ | `@supabase/ssr`, browser + server clients, middleware |
| 1.5 | JWT session management | ✅ | Handled by Supabase SSR cookies |
| 1.6 | Protected routes (reader app) | ✅ | Middleware guards `/library`, `/reader` |
| 1.7 | Protected routes (creator studio) | ✅ | Middleware guards all routes except `/login` |
| 1.8 | Profile / Settings page | 🔧 | Display name + prefs editable; avatar upload ⬜ |
| 1.9 | Logout flow | ✅ | Sidebar logout → `supabase.auth.signOut()` |

---

## SPRINT 2 — Creator Studio Core

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Creator Studio layout & sidebar | ✅ | App shell, nav, collapsible sidebar |
| 2.2 | Dashboard page (books in progress, published) | ✅ | Stats cards, book list, actions |
| 2.3 | Create new book flow | ✅ | Title + description → creates in Supabase |
| 2.4 | Book settings (title, description, price, cover) | ✅ | Editable inline |
| 2.5 | Supabase: `books` table CRUD | ✅ | `src/lib/supabase/books.ts` |
| 2.6 | Supabase: `characters` table CRUD | ✅ | Seeded with default Narrator on book create |
| 2.7 | List author books from DB | ✅ | `useBooks` hook, syncs to studioStore |
| 2.8 | Delete book | ✅ | Cascades to characters, chapters, scenes, blocks |
| 2.9 | Duplicate book | 🔧 | Creates blank copy — does not copy chapters/blocks yet |
| 2.10 | Publish / unpublish toggle | 🔧 | Writes status to DB; book not yet served to store |
| 2.11 | Preview reader from Studio | ✅ | "Preview" button opens `/reader/[id]?preview=1` — bypasses ownership gate |

---

## SPRINT 3 — Story Editor (Block System)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Block-based story editor (center canvas) | ✅ | Full block editor |
| 3.2 | Narration block | ✅ | |
| 3.3 | Dialogue block (character + text + emotion) | ✅ | |
| 3.4 | Thought block | ✅ | |
| 3.5 | Quote / Poem block (with style variants) | ✅ | `poem`, `letter`, `quran`, `default` |
| 3.6 | Pause block | ✅ | |
| 3.7 | SFX Trigger block | ✅ | |
| 3.8 | Chapter / Scene tree navigator | ✅ | Inline rename, add/delete |
| 3.9 | Add / delete chapter | ✅ | Persists to Supabase |
| 3.10 | Add / delete scene | ✅ | Persists to Supabase |
| 3.11 | Add / edit / delete blocks | ✅ | Optimistic UI + Supabase write-back |
| 3.12 | Supabase: `chapters`, `scenes`, `blocks` CRUD | ✅ | `src/lib/supabase/blocks.ts` |
| 3.13 | Load story content from Supabase on open | ✅ | `useEditor` hook, fetches on mount |
| 3.14 | Drag-and-drop block reordering | ⬜ | |
| 3.15 | Auto-save | ⬜ | Currently: every mutation saves immediately |
| 3.16 | Undo / redo | ⬜ | |

---

## SPRINT 4 — Characters, Voices & Audio

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Character management page | ✅ | Name, role, color, voice source |
| 4.2 | Add / edit / delete character | ✅ | Persists to Supabase `characters` table |
| 4.3 | Character color picker | ✅ | |
| 4.4 | Character role (narrator / character) | ✅ | |
| 4.5 | Voice Library page (browse & assign voices) | ✅ | 17 voices with real `speechSynthesis` preview, pitch/rate per voice, narrator tab |
| 4.6 | AI TTS voice generation (per block) | 🔧 | Requires creator's own OpenAI/ElevenLabs key in Settings |
| 4.7 | TTS provider integration (OpenAI / ElevenLabs) | 🔧 | Route built; only works with user-supplied API key |
| 4.8 | Upload recorded audio per block | ✅ | AudioUploadRow upload + Supabase Storage |
| 4.9 | Audio preview player | ✅ | Mini player in AudioUploadRow (play/pause/progress/time) |
| 4.10 | Voice assignment (character → voice ID) | ✅ | BlockItem passes char voiceId → AudioUploadRow → TTS |
| 4.11 | Scene atmosphere designer (ambience + music) | ✅ | SceneAtmospherePanel: upload, mini player, volume, Supabase persist |
| 4.12 | SFX library browser | ✅ | SfxLibrary: 26 presets across 5 categories, click-to-assign |
| 4.13 | Asset manager (upload & manage files) | ✅ | Real Supabase Storage listing: `assets` + `covers` buckets, play/preview, delete |
| 4.14 | Cloudflare R2 upload integration | ⬜ | Blocked by R2 bucket setup |
| 4.15 | Audio credits usage meter | ✅ | `tts_chars_used/limit` in profiles; `increment_tts_chars` RPC; progress bar in Settings |
| 4.16 | **Browser TTS voice preview in Voice Library** | ✅ | `window.speechSynthesis.speak()` per card; gender-matched browser voice selection |
| 4.17 | **Narrator-only mode** (single voice reads all) | ✅ | Book-level toggle in Voices → Settings tab; reader engine fully honours it |
| 4.18 | **Creator audio QA gate before publish** | ✅ | `getUncoveredCount()` — dialog warns with block count before first publish |

---

## SPRINT 4b — Text Import (Writer Workflow)

| # | Task | Status | Notes |
|---|------|--------|-------|
| T.1 | Text import modal (paste / file upload) | ✅ | TextImportModal: split-panel, .txt/.md/.fountain support |
| T.2 | Auto-detect format (prose / script / markdown) | ✅ | detectFormat(): script tag density + markdown header heuristic |
| T.3 | Smart paragraph splitter | ✅ | splitIntoParagraphs() |
| T.4 | Chapter / scene header detection | ✅ | isChapterHeader / isSceneHeader / extractTitle helpers |
| T.5 | Block type detection | ✅ | Full prose + script + markdown parsing |
| T.6 | Inline dialogue extraction from prose paragraphs | ✅ | splitProseDialogue() |
| T.7 | Import preview (chapter/scene tree + first 5 blocks) | ✅ | |
| T.8 | Import into book | ✅ | handleImport() in studio page |
| T.9 | Dialogue placeholder (characterId: '' — assign after import) | ✅ | |
| T.10 | PDF text extraction | ⬜ | Currently: convert to .txt first |

---

## SPRINT 4c — Polish, Infrastructure & Bug Fixes

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4c.1 | Book Settings Panel (metadata slide-out) | ✅ | Description, genre, age rating, estimated time, cover icon + gradient |
| 4c.2 | Scene image upload | ✅ | Upload to Supabase `covers` bucket; preview + delete in SceneAtmospherePanel |
| 4c.3 | Block browser TTS preview ("Preview" button) | ✅ | `speechSynthesis` per block in AudioUploadRow; no API key needed |
| 4c.4 | Delete story confirmation dialog | ✅ | Modal with story title + irreversible warning before Supabase delete |
| 4c.5 | Supabase Storage buckets + RLS | ✅ | `audio` (50 MB) + `covers` (5 MB) buckets; public read, auth upload/delete |
| 4c.6 | Seed SQL — two demo stories | ✅ | `006_seed_demo_stories.sql`: Whispering Forest + Midnight Circuit, 41 blocks |
| 4c.7 | RLS fix — anon read of published books | ✅ | `status = 'published' OR author_id = auth.uid()` covers both anon + auth |
| 4c.8 | Hydration fix (`useHydrated` hook) | ✅ | Guards Zustand persist reads on Navbar, Store, Library, Book pages |
| 4c.9 | SEO metadata — reader-app | ✅ | Root layout + `/store` static meta + `/book/[id]` dynamic `generateMetadata` |
| 4c.10 | Error pages | ✅ | `not-found.tsx` + `error.tsx` in both apps |
| 4c.11 | `BooksSync` component in studio layout | ✅ | Supabase → Zustand sync on every studio page, not just dashboard |
| 4c.12 | UUID guard in voices page | ✅ | Regex guard prevents `story-001` non-UUID from reaching Supabase |
| 4c.13 | Narrator voice columns in DB | ✅ | `007_narrator_only_mode.sql`: adds `narrator_only_mode` + `narrator_voice_id` |
| 4c.14 | Voice selector on narration blocks | ✅ | `VoiceSelect` dropdown in BlockItem; `characterId` stored on `NarrationBlock` |
| 4c.15 | Voice selector on quote blocks | ✅ | `VoiceSelect` dropdown alongside style picker on `QuoteBlock` |
| 4c.16 | Auto-expanding textareas in block editor | ✅ | `AutoTextarea` component — height set to `scrollHeight` on every keystroke |
| 4c.17 | Reader engine: characterId on all block types | ✅ | TTS voice slot + real-audio volume respect `characterId` on narration/quote blocks |


---

## SPRINT 5 — Reader Engine

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Store page (`/store`) | ✅ | Story grid, hero, genre tags |
| 5.2 | Book landing page (`/book/[id]`) | ✅ | Cover, cast, chapters, buy CTA |
| 5.3 | Library page (`/library`) | ✅ | Progress rings, continue reading |
| 5.4 | Reader Engine page (`/reader/[id]`) | ✅ | Full rendering engine |
| 5.5 | All block types rendered | ✅ | narration, dialogue, thought, quote, sfx, pause |
| 5.10 | Active block highlight + past block fade | ✅ | |
| 5.12 | Auto-scroll to active block | ✅ | |
| 5.13 | Reading Mode | ✅ | |
| 5.14 | Audiobook Mode (Web Speech API) | ✅ | Browser TTS fallback |
| 5.15 | Cinematic Mode | ✅ | |
| 5.16–5.18 | Play/Pause, skip, speed control | ✅ | |
| 5.19–5.21 | Volume sliders (narrator, character, music) | ✅ | |
| 5.22–5.24 | Font size, theme, dyslexia font | ✅ | |
| 5.25 | Table of contents drawer | ✅ | |
| 5.26–5.28 | Progress bar, resume, Supabase sync | ✅ | |
| 5.29 | Web Speech API voice per character | ✅ | |
| 5.30 | Real audio file playback (Web Audio API) | ⬜ | Needs actual uploaded audio assets |
| 5.31 | Multi-layer audio mixing (voice + music + sfx) | ⬜ | |
| 5.32 | Store loads books from Supabase (not seed data) | ✅ | `fetchPublishedBooks()` + `usePublishedBooks` hook; RLS anon read |
| 5.33 | Reader loads book content from Supabase | ✅ | `fetchBook(id)` — full chapters/scenes/blocks from DB |
| 5.34 | Closed captions / subtitles | ⬜ | Accessibility |
| 5.35 | Audio-only mode | ⬜ | Accessibility |

---

## SPRINT 6 — Payments & Marketplace

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Buy button (reader app) | ✅ | Calls `/api/stripe/checkout`; free books skip Stripe; spinner + error state |
| 6.2 | Stripe checkout session | ✅ | `/api/stripe/checkout/route.ts` — creates hosted session; free books upsert directly |
| 6.3 | Stripe webhook handler | ✅ | `/api/stripe/webhook/route.ts` — validates sig, upserts `purchases` on `checkout.session.completed` |
| 6.4 | Purchase record in database | ✅ | Webhook upserts `{user_id, book_id, price_paid}`; idempotent |
| 6.5 | Library unlocks after payment | ✅ | `useSync` loads `purchases` → Zustand library; `?purchased=1` redirect adds book immediately |
| 6.6 | Book ownership gate in reader | ✅ | |
| 6.7 | Creator revenue dashboard | ⬜ | |
| 6.8 | Author payout system | 🚫 | Post-MVP |

---

## PUBLISH PIPELINE

| # | Task | Status | Notes |
|---|------|--------|-------|
| P.1 | Publish page in Creator Studio | ✅ | UI built |
| P.2 | Publish writes `status='published'` to DB | ✅ | `publishBook()` updates DB + Zustand store; QA gate for missing audio |
| P.3 | Published book appears in reader store | ✅ | Reader store queries `status=published`; appears live after publish |
| P.4 | Book content served from Supabase to reader | ✅ | Full block tree fetched by `fetchBook()` in reader engine |
| P.5 | Unpublish / take down | ✅ | Publish button toggles draft↔published; same RLS |
| P.6 | PBF package / asset bundling | 🚫 | Post-MVP |
| P.7 | AES-256 encryption (soft DRM) | 🚫 | Post-MVP |

---

## LANDING PAGE & MARKETING

| # | Task | Status | Notes |
|---|------|--------|-------|
| L.1 | Landing page (`/`) for reader app | ✅ | Full cinematic page at `src/app/page.tsx` |
| L.2 | Hero section | ✅ | Gradient headline, reader preview card, ambient glow |
| L.3 | Problem / Solution section | ✅ | eBook vs Audiobook vs PageCast cards |
| L.4 | How It Works (3-step) | ✅ | Reading / Audiobook / Cinematic mode cards |
| L.5 | Reader demo section | ✅ | Inline story excerpt preview card in hero |
| L.6 | Creator value proposition section | ✅ | Split layout + Creator Studio mockup |
| L.7 | Why PageCast comparison table | ✅ | 8-row feature grid |
| L.8 | Early access / Beta CTA section | ✅ | "Your first story is free" banner |
| L.9 | Footer with links | ✅ | 4-column footer |
| L.10 | Email capture | ✅ | Form with success state |
| L.11 | Mobile responsive layout | ✅ | Hamburger nav, stacked grids, fluid |

---

## BACKEND API (NestJS — future)

| # | Task | Status | Notes |
|---|------|--------|-------|
| B.1 | NestJS project scaffolded | ⬜ | Currently using Next.js API routes |
| B.2–B.16 | Auth, books, purchases, TTS, deploy | ⬜ | Next.js routes cover TTS for now |

---

## FUTURE ROADMAP (Post-MVP)

| # | Feature | Priority |
|---|---------|----------|
| R.1 | Subscription model ("Netflix for audio storybooks") | High |
| R.2 | AI voice credit billing system | High |
| R.3 | AI voice marketplace (curated voices) | Medium |
| R.4 | Multi-language audio tracks | Medium |
| R.5 | Animation & visual story layer | Medium |
| R.6 | Interactive story branching | Low |
| R.7 | Creator analytics dashboard | Medium |
| R.8 | Social features (reviews, follows) | Low |

---

## BUG FIXES & DATA INTEGRITY

| # | Fix | Status | Notes |
|---|-----|--------|-------|
| B.1 | `reading_progress` 400 error | ✅ | UUID guard in `saveProgress()` — skips non-UUID book IDs (demo stories) |
| B.2 | `readerStore` demo library seed removed | ✅ | `library: []` — populated by `useSync` from Supabase `purchases` table |
| B.3 | Library page uses real Supabase books | ✅ | `usePublishedBooks` hook replaces `DEMO_STORIES.filter()` |
| B.4 | Stripe `apiVersion` mismatch | ✅ | Updated to `2026-04-22.dahlia` (installed package version) |
| B.5 | `story-001` non-UUID 400 errors | ✅ | `studioStore` seed removed; UUID regex guard in voices page |

