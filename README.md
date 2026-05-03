# PageCast — Monorepo

> *Where stories find their voice.*

## Apps

| App | Port | Status |
|-----|------|--------|
| `apps/creator-studio` | **3801** | ✅ MVP Ready |
| `apps/reader-app` | **3800** | 🔜 Coming next |

---

## Getting Started

### 1. Install dependencies

```bash
cd apps/creator-studio
npm install
```

### 2. Run Creator Studio

```bash
npm run dev
# → http://localhost:3801
```

### 3. Login (mock auth)

- Email: `myeffort.studio@gmail.com`
- Password: any non-empty string

---

## Creator Studio — Pages

| Route | Page |
|-------|------|
| `/dashboard` | Story library + stats |
| `/studio/[id]` | Block-based story editor |
| `/voices` | Cast management + voice library |
| `/assets` | Music, SFX, image manager |
| `/settings` | TTS API key + preferences |

---

## Book Format

Stories are saved using the **PBF (PageCast Book File)** format — v1.0.

See `docs/pagecast-documentation.md` for the full system specification.
