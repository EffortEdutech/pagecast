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
| 0.3 | Initial commit & push to `main` | ✅ | Sprints 1–3 committed and pushed |
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

**`apps/backend/.env`** *(when NestJS is scaffolded — Sprint 4)*
```
DATABASE_URL=                 # Supabase → Settings → Database → Connection string
SUPABASE_SERVICE_KEY=         # Service role key — see external_services.txt
R2_ACCOUNT_ID=2c89a228789d6a63a431e5d13391d452
R2_ACCESS_KEY_ID=             # Fill when R2 bucket is created
R2_SECRET_ACCESS_KEY=         # Fill when R2 bucket is created
R2_BUCKET_NAME=pagecast-assets
R2_PUBLIC_URL=                # Custom domain or R2 public URL
STRIPE_SECRET_KEY=            # Fill when Stripe is set up
STRIPE_WEBHOOK_SECRET=        # Fill after Render URL is known
JWT_SECRET=                   # Generate: openssl rand -base64 32
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
| 2.10 | Publish / unpublish toggle | 🔧 | UI only — does not write to DB yet |
| 2.11 | Preview reader from Studio | ⬜ | |

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
| 3.15 | Auto-save | ⬜ | Currently manual (every mutation saves immediately) |
| 3.16 | Undo / redo | ⬜ | |

---

## SPRINT 4 — Characters, Voices & Audio

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Character management page | ✅ | Name, role, color, voice source |
| 4.2 | Add / edit / delete character | ✅ | Persists to Supabase `characters` table |
| 4.3 | Character color picker | ✅ | |
| 4.4 | Character role (narrator / character) | ✅ | |
| 4.5 | Voice Studio page (audio management) | ✅ | UI shell built |
| 4.6 | AI TTS voice generation (per block) | ✅ | Wand2 Generate button in AudioUploadRow; calls /api/tts/generate |
| 4.7 | TTS provider integration (OpenAI / ElevenLabs) | ✅ | /api/tts/generate route; OPENAI_VOICE_MAP; ElevenLabs fallback |
| 4.8 | Upload recorded audio per block | ✅ | AudioUploadRow upload + Supabase Storage |
| 4.9 | Audio preview player | ✅ | Mini player in AudioUploadRow (play/pause/progress/time) |
| 4.10 | Voice assignment (character → voice ID) | ✅ | BlockItem passes char voiceId → AudioUploadRow → TTS |
| 4.11 | Scene atmosphere designer (ambience + music) | ✅ | SceneAtmospherePanel: upload, mini player, volume, Supabase persist; reader fade-in/out |
| 4.12 | SFX library browser | ✅ | SfxLibrary component: 26 presets across 5 categories, click-to-assign in SFX block |
| 4.13 | Asset manager (upload & manage files) | ⬜ | |
| 4.14 | Cloudflare R2 upload integration | ⬜ | Blocked by R2 bucket setup |
| 4.15 | Audio credits usage meter | ⬜ | Post-free-tier feature |

---

## SPRINT 4b — Text Import (Writer Workflow)

| # | Task | Status | Notes |
|---|------|--------|-------|
| T.1 | Text import modal (paste / file upload) | ✅ | TextImportModal: split-panel, .txt/.md/.fountain support |
| T.2 | Auto-detect format (prose / script / markdown) | ✅ | detectFormat(): script tag density + markdown header heuristic |
| T.3 | Smart paragraph splitter | ✅ | splitIntoParagraphs(): handles double-newline AND single-newline (PDF exports) |
| T.4 | Chapter / scene header detection | ✅ | isChapterHeader / isSceneHeader / extractTitle helpers |
| T.5 | Block type detection (narration / dialogue / thought / quote / sfx / pause) | ✅ | Full prose + script + markdown parsing |
| T.6 | Inline dialogue extraction from prose paragraphs | ✅ | splitProseDialogue(): splits "Hello," said John. → dialogue + narration |
| T.7 | Import preview (chapter/scene tree + first 5 blocks) | ✅ | ChapterPreview + BlockPreviewRow components |
| T.8 | Import into book (creates chapters/scenes/blocks in editor) | ✅ | handleImport() in studio page |
| T.9 | Dialogue placeholder (characterId: '' — assign after import) | ✅ | Note shown in preview panel |
| T.10 | PDF text extraction | ⬜ | Currently: convert to .txt first; future: /api/pdf/extract route |

---

## SPRINT 5 — Reader Engine

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Store page (`/store`) | ✅ | Story grid, hero, genre tags |
| 5.2 | Book landing page (`/book/[id]`) | ✅ | Cover, cast, chapters, buy CTA |
| 5.3 | Library page (`/library`) | ✅ | Progress rings, continue reading |
| 5.4 | Reader Engine page (`/reader/[id]`) | ✅ | Full rendering engine |
| 5.5 | Narration block rendering | ✅ | |
| 5.6 | Dialogue block rendering (with character color) | ✅ | |
| 5.7 | Thought block rendering | ✅ | |
| 5.8 | Quote / Poem block rendering | ✅ | |
| 5.9 | SFX block rendering (label + skip) | ✅ | |
| 5.10 | Active block highlight (glow + left border) | ✅ | |
| 5.11 | Past block fade | ✅ | |
| 5.12 | Auto-scroll to active block | ✅ | |
| 5.13 | Reading Mode (manual scroll) | ✅ | |
| 5.14 | Audiobook Mode (auto-play + highlight) | ✅ | Web Speech API |
| 5.15 | Cinematic Mode (fullscreen, one block at a time) | ✅ | |
| 5.16 | Play / Pause controls | ✅ | |
| 5.17 | Skip forward / back controls | ✅ | |
| 5.18 | Playback speed control (0.75x–2x) | ✅ | |
| 5.19 | Narrator volume slider | ✅ | |
| 5.20 | Character volume slider | ✅ | |
| 5.21 | Music volume slider | ✅ | |
| 5.22 | Font size control (sm / base / lg / xl) | ✅ | |
| 5.23 | Theme switcher (dark / light / sepia) | ✅ | |
| 5.24 | Dyslexia font toggle | ✅ | |
| 5.25 | Table of contents drawer | ✅ | Jump to any chapter/scene |
| 5.26 | Reading progress bar (% complete) | ✅ | |
| 5.27 | Resume from last position | ✅ | Zustand persist |
| 5.28 | Progress saved per story | ✅ | Supabase `reading_progress` table via `useSync` |
| 5.29 | Web Speech API voice per character | ✅ | Browser TTS, voice rotation |
| 5.30 | Real audio file playback (Web Audio API) | ⬜ | Needs actual audio assets |
| 5.31 | Multi-layer audio mixing (voice + music + sfx) | ⬜ | Web Audio API integration |
| 5.32 | Streaming audio per scene | ⬜ | Backend + signed URLs required |
| 5.33 | Closed captions / subtitles | ⬜ | Accessibility feature |
| 5.34 | Audio-only mode | ⬜ | Accessibility feature |
| 5.35 | High contrast theme | ⬜ | Accessibility feature |
| 5.36 | Sandboxed iframe rendering (DRM) | ⬜ | Post-MVP |
| 5.37 | Disable right-click / text selection (DRM) | ⬜ | Post-MVP |

---

## SPRINT 6 — Payments & Marketplace

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Buy button (reader app) | 🔧 | Demo mode — adds to library free |
| 6.2 | Stripe checkout session (backend) | ⬜ | |
| 6.3 | Stripe webhook handler | ⬜ | |
| 6.4 | Purchase record in database | 🔧 | `purchases` table exists; `acquireBook` helper built; no Stripe yet |
| 6.5 | Library unlocks after payment | 🔧 | Works in demo (mock) |
| 6.6 | Book ownership gate in reader | ✅ | Redirects to `/book` if not owned |
| 6.7 | Creator revenue dashboard | ⬜ | |
| 6.8 | Author payout system | 🚫 | Post-MVP |

---

## PUBLISH SYSTEM (Sprint 4–5 overlap)

| # | Task | Status | Notes |
|---|------|--------|-------|
| P.1 | Publish page in Creator Studio | ✅ | UI built |
| P.2 | PBF package generation (`story.html` + `production.json`) | ⬜ | |
| P.3 | Asset bundling into `.pbf` archive | ⬜ | |
| P.4 | AES-256 encryption of production layer | ⬜ | Post-MVP soft DRM |
| P.5 | Upload `.pbf` to Cloudflare R2 | ⬜ | |
| P.6 | Book listed in store after publish | ⬜ | Currently seed data only |
| P.7 | Unpublish / take down | ⬜ | |

---

## LANDING PAGE & MARKETING

| # | Task | Status | Notes |
|---|------|--------|-------|
| L.1 | Landing page (`/`) for reader app | ⬜ | Currently redirects to `/store` |
| L.2 | Hero section with live demo simulation | ⬜ | |
| L.3 | Problem / Solution sections | ⬜ | |
| L.4 | How It Works (3-step) | ⬜ | |
| L.5 | Reader experience demo section (animated) | ⬜ | |
| L.6 | Creator value proposition section | ⬜ | |
| L.7 | Why PageCast comparison table | ⬜ | |
| L.8 | Early access / Beta CTA section | ⬜ | |
| L.9 | Footer with links | ⬜ | |
| L.10 | Email capture for beta waitlist | ⬜ | |
| L.11 | Mobile responsive layout | 🔧 | Reader app is responsive; landing page missing |

---

## BACKEND API (NestJS Monolith)

| # | Task | Status | Notes |
|---|------|--------|-------|
| B.1 | NestJS project scaffolded | ⬜ | |
| B.1a | `GET /health` — keep-alive endpoint for cron-job.org | ⬜ | Returns `{ status: "ok", timestamp }` |
| B.2 | `POST /auth/signup` | ⬜ | |
| B.3 | `POST /auth/login` | ⬜ | |
| B.4 | `GET /books` — list published stories | ⬜ | |
| B.5 | `GET /books/:id` — story detail | ⬜ | |
| B.6 | `POST /books` — create book (author) | ⬜ | |
| B.7 | `PUT /books/:id` — update book | ⬜ | |
| B.8 | `POST /books/:id/publish` — publish book | ⬜ | |
| B.9 | `GET /library` — reader's purchased books | ⬜ | |
| B.10 | `POST /purchases` — Stripe checkout session | ⬜ | |
| B.11 | `POST /webhooks/stripe` — payment confirmed | ⬜ | |
| B.12 | `GET /assets/signed-url` — secure asset access | ⬜ | |
| B.13 | `POST /tts/generate` — AI voice generation | ⬜ | |
| B.14 | Database migrations (Supabase) | ✅ | `docs/supabase-schema.sql` applied manually |
| B.15 | JWT middleware | ⬜ | |
| B.16 | Deploy to Render | ⬜ | |

---

## FUTURE ROADMAP (Post-MVP · Do not build yet)

| # | Feature | Priority |
|---|---------|----------|
| R.1 | Subscription model ("Netflix for audio storybooks") | High |
| R.2 | AI voice credit billing system | High |
| R.3 | AI voice marketplace (curated voices) | Medium |
| R.4 | Multi-language audio tracks | Medium |
| R.5 | Animation & visual story layer | Medium |
| R.6 | Interactive story branching (choose your path) | High |
| R.7 | Shared reading rooms (sync playback) | High |
| R.8 | WebRTC voice chat reading rooms | Low |
| R.9 | Global live reading events | Low |
| R.10 | AI-assisted story drafting | Medium |
| R.11 | Hard DRM (AES streaming + device binding) | High |
| R.12 | Offline mode (encrypted local cache) | Medium |
| R.13 | Mobile native apps (iOS / Android) | High |
| R.14 | PBF format v2 (animation blocks, choices) | Medium |

---

## AUDIENCE & CREATOR TEST READINESS

### ✅ Ready now (can be tested today)
- Browse the store at `/store`
- View any story landing page at `/book/[id]`
- "Buy" a story (mock — free in demo mode)
- Read in Reading Mode, Audiobook Mode, Cinematic Mode
- Hear browser TTS voices per character
- Adjust font, theme, speed, volume in settings panel
- Navigate TOC, track progress, resume reading
- View library with progress rings at `/library`
- Sign up / log in to Creator Studio (Supabase Auth — real accounts)
- Create books, chapters, scenes, and story blocks — all persist to Supabase DB
- Characters saved to DB per book

### 🔧 Needs work before audience test
- [ ] Real audio files (currently TTS browser voices only)
- [ ] Landing page (currently skips to `/store`)
- [ ] Real payment flow (currently demo/free)
- [ ] Books created in Studio need to appear in Reader store

### 🔧 Needs work before creator test
- [ ] Publish toggle → writes `status=published` to DB
- [ ] Published books surfaced in reader store
- [ ] Audio upload / TTS generation (Sprint 4)
- [ ] Duplicate book copies chapters+blocks (currently blank copy)

---

*Last updated: 2026-05-03 — Sprints 1–4 complete (TTS, scene atmosphere, text import)*
