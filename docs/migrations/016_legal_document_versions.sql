-- ============================================================
-- PageCast Migration 016 - Current Legal Document Versions
-- ============================================================

insert into public.legal_documents (type, version, title, content, published_at, effective_at)
values
  (
    'privacy',
    '2026-05-16',
    'Privacy Policy',
    'PageCast privacy baseline covering account data, purchases, reading progress, creator uploads, support messages, legal requests, international processing, and user privacy rights.',
    now(),
    now()
  ),
  (
    'terms',
    '2026-05-16',
    'Reader Terms of Service',
    'PageCast reader terms covering account access, Cast browsing, purchases, acceptable use, content availability, and service rules.',
    now(),
    now()
  ),
  (
    'creator-terms',
    '2026-05-16',
    'Creator Terms',
    'PageCast creator terms covering publishing permissions, rights warranties, manuscript/audio/asset rights, AI disclosure, and platform enforcement.',
    now(),
    now()
  ),
  (
    'ai-disclosure',
    '2026-05-16',
    'AI and Synthetic Audio Disclosure',
    'PageCast disclosure baseline for synthetic narration, AI-generated content, voice consent, and creator review responsibility.',
    now(),
    now()
  )
on conflict (type, version) do update
set title = excluded.title,
    content = excluded.content,
    published_at = excluded.published_at,
    effective_at = excluded.effective_at;
