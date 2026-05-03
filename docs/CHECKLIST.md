# PageCast — Development Progress Checklist
> Derived from `pagecast-documentation.md` · Updated as we build
>
> **Legend:** ✅ Done · 🔧 Partial · ⬜ Not started · 🚫 Post-MVP (roadmap)

---

## SPRINT 0 — Infrastructure & Monorepo

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Monorepo root (`/pageCast`) with shared packages | ✅ | `apps/`, `packages/`, root `package.json` |
| 0.2 | Reader App scaffolded (Next.js, port 3800) | ✅ | `apps/reader-app` |
| 0.3 | Creator Studio scaffolded (Next.js, port 3801) | ✅ | `apps/creator-studio` |
| 0.4 | Shared TypeScript types package | ✅ | `packages/types` or `src/types/index.ts` |
| 0.5 | Tailwind + design token system (dark theme) | ✅ | `tailwind.config.ts`, `globals.css` |
| 0.6 | Supabase project created | ⬜ | Needed before auth sprint |
| 0.7 | Cloudflare R2 bucket created | ⬜ | Needed before audio upload sprint |
| 0.8 | Stripe account created | ⬜ | Needed before payments sprint |
| 0.9 | Vercel deployment (reader-app) | ⬜ | |
| 0.10 | Vercel deployment (creator-studio) | ⬜ | |
| 0.11 | GitHub repo initialised & pushed | ✅ | https://github.com/EffortEdutech/pagecast |

---

## SPRINT 1 — Authentication System

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Sign up page | 🔧 | Mock login built in creator-studio |
| 1.2 | Login page | 🔧 | Mock login built in creator-studio |
| 1.3 | User role selection (reader / creator) | ⬜ | |
| 1.4 | Supabase Auth integration (backend) | ⬜ | |
| 1.5 | JWT session management | ⬜ | |
| 1.6 | Protected routes (reader app) | ⬜ | Currently open — no auth gate |
| 1.7 | Protected routes (creator studio) | 🔧 | Mock gate exists |
| 1.8 | Profile page | ⬜ | |
| 1.9 | Logout flow | ⬜ | |

---

## SPRINT 2 — Creator Studio Core

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Creator Studio layout & sidebar | ✅ | App shell, nav, collapsible sidebar |
| 2.2 | Dashboard page (books in progress, published) | ✅ | Stats cards, book list, actions |
| 2.3 | Create new book flow | ✅ | Title, description, genre, price |
| 2.4 | Book settings (title, description, price, cover) | ✅ | |
| 2.5 | Backend: `POST /books` — create book API | ⬜ | Currently all local state (no DB) |
| 2.6 | Backend: `GET /books` — list author books API | ⬜ | |
| 2.7 | Backend: `PUT /books/:id` — update book API | ⬜ | |
| 2.8 | Database: `books` table | ⬜ | |
| 2.9 | Database: `chapters` table | ⬜ | |
| 2.10 | Duplicate book action | ⬜ | UI hook exists, no backend |
| 2.11 | Publish / unpublish toggle | 🔧 | UI only |
| 2.12 | Preview reader from Studio | ⬜ | |

---

## SPRINT 3 — Story Editor (Block System)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Block-based story editor (center canvas) | ✅ | Full block editor built |
| 3.2 | Narration block | ✅ | |
| 3.3 | Dialogue block (character + text + emotion) | ✅ | |
| 3.4 | Thought block | ✅ | |
| 3.5 | Quote / Poem block (with style variants) | ✅ | `poem`, `letter`, `quran`, `default` |
| 3.6 | Pause block | ✅ | |
| 3.7 | SFX Trigger block | ✅ | |
| 3.8 | Chapter / Scene tree navigator (left sidebar) | ✅ | |
| 3.9 | Add / delete chapter | ✅ | |
| 3.10 | Add / delete scene | ✅ | |
| 3.11 | Drag-and-drop block reordering | ⬜ | |
| 3.12 | Block properties panel (right panel) | 🔧 | Inline editing only |
| 3.13 | Save story to backend (JSON persistence) | ⬜ | Currently local/Zustand only |
| 3.14 | Auto-save | ⬜ | |
| 3.15 | Undo / redo | ⬜ | |

---

## SPRINT 4 — Characters, Voices & Audio

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Character management page | ✅ | Name, role, color, voice source |
| 4.2 | Add / edit / delete character | ✅ | |
| 4.3 | Character color picker | ✅ | |
| 4.4 | Character role (narrator / character) | ✅ | |
| 4.5 | Voice Studio page (audio management) | ✅ | UI shell built |
| 4.6 | AI TTS voice generation (per block) | ⬜ | BYO API key model needed |
| 4.7 | TTS provider integration (OpenAI / ElevenLabs) | ⬜ | |
| 4.8 | Upload recorded audio per block | ⬜ | |
| 4.9 | Audio preview player | ⬜ | |
| 4.10 | Voice assignment (character → voice ID) | 🔧 | UI ready, no TTS backend |
| 4.11 | Scene atmosphere designer (ambience + music) | 🔧 | Fields exist in schema, no asset browser |
| 4.12 | SFX library browser | ⬜ | |
| 4.13 | Asset manager (upload & manage files) | ⬜ | |
| 4.14 | Cloudflare R2 upload integration | ⬜ | |
| 4.15 | Audio credits usage meter | ⬜ | Post-free-tier feature |

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
| 5.10 | Active block highlight (glow + left border) | ✅ | `.block-active` CSS |
| 5.11 | Past block fade | ✅ | `.block-past` opacity |
| 5.12 | Auto-scroll to active block | ✅ | `scrollIntoView` |
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
| 5.28 | Progress saved per story | ✅ | |
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
| 6.4 | Purchase record in database | ⬜ | Currently Zustand localStorage |
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
| B.14 | Database migrations (Supabase) | ⬜ | |
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
- Browse Creator Studio at port 3801

### 🔧 Needs work before audience test
- [ ] Real audio files (currently TTS browser voices only)
- [ ] Landing page (currently skips to `/store`)
- [ ] Real payment flow (currently demo/free)
- [ ] Backend + database (currently all in-memory / localStorage)

### 🔧 Needs work before creator test
- [ ] Real auth (currently mock login in creator studio)
- [ ] Story save to backend (currently lost on refresh)
- [ ] Audio upload / TTS generation
- [ ] Publish → book appears in store (currently seed data only)

---

*Last updated: 2026-05-03*
