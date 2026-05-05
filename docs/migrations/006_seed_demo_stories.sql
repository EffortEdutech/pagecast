-- ============================================================
-- Migration 006 — Demo seed data for functional testing
-- Run in: Supabase Dashboard → SQL Editor  (postgres role)
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0.  ANON READ — allow unauthenticated users to browse the
--     store and open books (needed for the landing + store pages)
-- ────────────────────────────────────────────────────────────

-- Drop old authenticated-only policies first (idempotent)
drop policy if exists "Published books are visible to all"      on public.books;
drop policy if exists "Characters visible if book visible"      on public.characters;
drop policy if exists "Chapters visible if book visible"        on public.chapters;
drop policy if exists "Scenes visible if book visible"          on public.scenes;
drop policy if exists "Blocks visible if book visible"          on public.blocks;

-- Re-create with anon support (auth.uid() can be null for anon)
create policy "Published books are visible to all"
  on public.books for select
  using (status = 'published' or author_id = auth.uid());

create policy "Characters visible if book visible"
  on public.characters for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Chapters visible if book visible"
  on public.chapters for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Scenes visible if book visible"
  on public.scenes for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Blocks visible if book visible"
  on public.blocks for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

-- Also allow anon to read profiles of published-book authors
drop policy if exists "Author profiles visible for published books" on public.profiles;
create policy "Author profiles visible for published books"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.books b
      where b.author_id = id and b.status = 'published'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 1.  DEMO AUTHOR — fake auth.users row so FK is satisfied
--     UUID: a0000000-0000-0000-0000-000000000001
-- ────────────────────────────────────────────────────────────

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo@pagecast.app',
  '$2a$10$placeholder_not_a_real_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  now(),
  now(),
  now(),
  '{"display_name": "PageCast Demo", "role": "creator"}',
  false,
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

insert into public.profiles (id, email, display_name, role)
values (
  'a0000000-0000-0000-0000-000000000001',
  'demo@pagecast.app',
  'PageCast Demo',
  'creator'
)
on conflict (id) do update set
  display_name = excluded.display_name,
  role         = excluded.role;

-- ────────────────────────────────────────────────────────────
-- 2.  BOOK 1 — "The Whispering Forest"
--     A short fantasy story. Tests: narration, dialogue,
--     thought, pause, quote blocks.
-- ────────────────────────────────────────────────────────────

insert into public.books (
  id, author_id, title, description,
  cover_gradient, cover_emoji, genre, age_rating,
  status, price, is_free, estimated_time
)
values (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'The Whispering Forest',
  'When seventeen-year-old Elara follows a trail of silver light into the ancient Moonwood, she discovers a world where trees remember every secret ever whispered beneath their branches — and one secret may change everything she knows about herself.',
  'from-emerald-900 via-teal-900 to-bg-primary',
  '🌲',
  'Fantasy',
  'Teen+',
  'published',
  0.00,
  true,
  '12'
)
on conflict (id) do update set
  title          = excluded.title,
  description    = excluded.description,
  status         = excluded.status;

-- ── Characters ───────────────────────────────────────────────

insert into public.characters (id, book_id, name, role, color, voice_label, voice_id, sort_order)
values
  ('c0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'Narrator', 'narrator', '#6B7280', 'Warm Narrator', 'ai_narrator_warm', 0),
  ('c0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000001',
   'Elara', 'character', '#8B5CF6', 'Young Female', 'ai_female_soft', 1),
  ('c0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'The Forest Spirit', 'character', '#10B981', 'Deep Mystic', 'ai_narrator_deep', 2)
on conflict (id) do nothing;

-- ── Chapter 1 — "Into the Woods" ─────────────────────────────

insert into public.chapters (id, book_id, title, sort_order)
values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Into the Woods',   0),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'The Spirit Speaks', 1)
on conflict (id) do nothing;

-- ── Scenes ───────────────────────────────────────────────────

insert into public.scenes (id, chapter_id, book_id, title, sort_order)
values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'The Silver Trail',     0),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'First Steps',          1),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'The Ancient Oak',      0),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Secrets of the Bark',  1)
on conflict (id) do nothing;

-- ── Blocks — Scene 1: "The Silver Trail" ─────────────────────

insert into public.blocks (id, scene_id, book_id, type, content, sort_order)
values
  ('f0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "The village of Thornhaven had three rules everyone knew by heart: never borrow from the Widow Maren, never eat the red mushrooms near the mill, and never — under any circumstances — follow the silver light into the Moonwood after dark."}',
   0),

  ('f0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "Elara had broken two of those rules before she turned fifteen. On the night of her seventeenth birthday, she was about to break the third."}',
   1),

  ('f0000000-0000-0000-0000-000000000003',
   'e0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'thought',
   '{"character_id": "c0000000-0000-0000-0000-000000000002", "text": "Just a few more steps. I only want to see where it goes."}',
   2),

  ('f0000000-0000-0000-0000-000000000004',
   'e0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "The light drifted between the oaks like a lantern carried by an invisible hand, never quite close enough to touch, always bright enough to follow. Elara pulled her cloak tighter and stepped off the cobblestones onto the soft carpet of pine needles."}',
   3),

  ('f0000000-0000-0000-0000-000000000005',
   'e0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'pause',
   '{"duration_ms": 1500}',
   4),

  ('f0000000-0000-0000-0000-000000000006',
   'e0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "The moment she crossed the tree line, the village sounds vanished. No wind. No crickets. Only the slow, rhythmic creak of branches — like the forest was breathing."}',
   5)

on conflict (id) do nothing;

-- ── Blocks — Scene 2: "First Steps" ──────────────────────────

insert into public.blocks (id, scene_id, book_id, type, content, sort_order)
values
  ('f0000000-0000-0000-0000-000000000010',
   'e0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "She had expected darkness. Instead, the Moonwood glowed with a pale, silver-blue light that seemed to rise from the moss itself. Every surface — bark, stone, fallen leaf — pulsed faintly, as if something beneath the earth had a heartbeat."}',
   0),

  ('f0000000-0000-0000-0000-000000000011',
   'e0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000001',
   'thought',
   '{"character_id": "c0000000-0000-0000-0000-000000000002", "text": "It''s beautiful. Why does everyone say to stay away?"}',
   1),

  ('f0000000-0000-0000-0000-000000000012',
   'e0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "A sound reached her — not a voice exactly, more like the memory of a voice. Words shaped from the rustle of leaves, from the tap of rain on bark. It was speaking to her. She was sure of it."}',
   2),

  ('f0000000-0000-0000-0000-000000000013',
   'e0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000001',
   'quote',
   '{"text": "Those who walk in the Moonwood do not wander by chance. The forest chooses its guests.", "attribution": "Old Thornhaven saying", "style": "default"}',
   3),

  ('f0000000-0000-0000-0000-000000000014',
   'e0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "Elara stopped walking. The silver trail had vanished. She stood alone in the centre of a small clearing, a ring of ancient oaks surrounding her like silent judges. And then, one of them moved."}',
   4)

on conflict (id) do nothing;

-- ── Blocks — Scene 3: "The Ancient Oak" ──────────────────────

insert into public.blocks (id, scene_id, book_id, type, content, sort_order)
values
  ('f0000000-0000-0000-0000-000000000020',
   'e0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "The bark of the largest oak split open like a wound healing in reverse. Light poured out — warm amber where everything else was silver — and from within it stepped a figure that seemed made entirely of the forest itself."}',
   0),

  ('f0000000-0000-0000-0000-000000000021',
   'e0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "Tall and slender, bark-dark skin threaded with veins of green light, eyes the colour of still water. The Forest Spirit regarded Elara with the calm patience of something that had seen centuries pass like afternoons."}',
   1),

  ('f0000000-0000-0000-0000-000000000022',
   'e0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000003", "text": "You came.", "emotion": "calm"}',
   2),

  ('f0000000-0000-0000-0000-000000000023',
   'e0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000002", "text": "I — I followed the light. I didn''t mean to trespass.", "emotion": "nervous"}',
   3),

  ('f0000000-0000-0000-0000-000000000024',
   'e0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000003", "text": "There is no trespass here for those the light chooses. The silver trail does not lead by accident, child. It led because you were ready.", "emotion": "gentle"}',
   4),

  ('f0000000-0000-0000-0000-000000000025',
   'e0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'thought',
   '{"character_id": "c0000000-0000-0000-0000-000000000002", "text": "Ready for what?"}',
   5),

  ('f0000000-0000-0000-0000-000000000026',
   'e0000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000001',
   'pause',
   '{"duration_ms": 2000}',
   6)

on conflict (id) do nothing;

-- ── Blocks — Scene 4: "Secrets of the Bark" ──────────────────

insert into public.blocks (id, scene_id, book_id, type, content, sort_order)
values
  ('f0000000-0000-0000-0000-000000000030',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000003", "text": "These trees remember every voice that has ever spoken beneath them. Every secret. Every promise. Every lie.", "emotion": "serious"}',
   0),

  ('f0000000-0000-0000-0000-000000000031',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "The Spirit pressed one long-fingered hand against the nearest oak. The bark lit up in patterns — spirals and lines, like writing in a language Elara almost recognised."}',
   1),

  ('f0000000-0000-0000-0000-000000000032',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000003", "text": "Your mother spoke to us once. Seventeen years ago. She asked us to keep a secret for her until you were old enough to hear it.", "emotion": "solemn"}',
   2),

  ('f0000000-0000-0000-0000-000000000033',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'thought',
   '{"character_id": "c0000000-0000-0000-0000-000000000002", "text": "My mother. She died when I was three. She was here. She was standing right here."}',
   3),

  ('f0000000-0000-0000-0000-000000000034',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000002", "text": "What did she say?", "emotion": "urgent"}',
   4),

  ('f0000000-0000-0000-0000-000000000035',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "The Forest Spirit smiled — the slow, deliberate smile of deep time — and placed both hands on Elara''s shoulders. Warmth flooded through her like sunlight through stained glass."}',
   5),

  ('f0000000-0000-0000-0000-000000000036',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000003", "text": "She said: the forest is her daughter''s inheritance. And that you would know, when you heard it, that it was true.", "emotion": "warm"}',
   6),

  ('f0000000-0000-0000-0000-000000000037',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'pause',
   '{"duration_ms": 3000}',
   7),

  ('f0000000-0000-0000-0000-000000000038',
   'e0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000001',
   'narration',
   '{"text": "Elara looked up at the canopy, at the silver light threading between ancient leaves, and felt, for the first time in seventeen years, that she was exactly where she was supposed to be."}',
   8)

on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────
-- 3.  BOOK 2 — "Midnight Circuit"
--     A short sci-fi story. Tests same block types + diff genre.
-- ────────────────────────────────────────────────────────────

insert into public.books (
  id, author_id, title, description,
  cover_gradient, cover_emoji, genre, age_rating,
  status, price, is_free, estimated_time
)
values (
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Midnight Circuit',
  'In a city that never sleeps, street mechanic Zara discovers her custom AI companion has started dreaming — and its dreams are pulling her toward a conspiracy buried in the city''s oldest server farm.',
  'from-blue-900 via-cyan-900 to-bg-primary',
  '🤖',
  'Sci-Fi',
  'Teen+',
  'published',
  0.00,
  true,
  '10'
)
on conflict (id) do update set
  title       = excluded.title,
  description = excluded.description,
  status      = excluded.status;

-- ── Characters ───────────────────────────────────────────────

insert into public.characters (id, book_id, name, role, color, voice_label, voice_id, sort_order)
values
  ('c0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000002',
   'Narrator', 'narrator', '#6B7280', 'Gritty Narrator', 'ai_narrator_warm', 0),
  ('c0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000002',
   'Zara', 'character', '#3B82F6', 'Young Female', 'ai_female_soft', 1),
  ('c0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'VEIL', 'character', '#06B6D4', 'Synthetic Voice', 'ai_narrator_deep', 2),
  ('c0000000-0000-0000-0000-000000000013',
   'b0000000-0000-0000-0000-000000000002',
   'Dispatch', 'character', '#F59E0B', 'Gruff Male', 'ai_male_gruff', 3)
on conflict (id) do nothing;

-- ── Chapters ─────────────────────────────────────────────────

insert into public.chapters (id, book_id, title, sort_order)
values
  ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002', 'Boot Sequence',    0),
  ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Ghost in the Grid', 1)
on conflict (id) do nothing;

-- ── Scenes ───────────────────────────────────────────────────

insert into public.scenes (id, chapter_id, book_id, title, sort_order)
values
  ('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002', 'The Workshop',    0),
  ('e0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002', 'Anomaly Detected', 1),
  ('e0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Deep Archive',    0)
on conflict (id) do nothing;

-- ── Blocks — Scene 1: "The Workshop" ─────────────────────────

insert into public.blocks (id, scene_id, book_id, type, content, sort_order)
values
  ('a1000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000002',
   'narration',
   '{"text": "02:17. The city of Neonhaven never turned off its lights, which meant it also never turned off its noise. Zara had stopped noticing three years ago."}',
   0),

  ('a1000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000002',
   'narration',
   '{"text": "She worked by the glow of her soldering iron, her workshop a cathedral of salvage: circuit boards stacked like altars, cables coiled like prayer beads, the smell of burnt solder and cold coffee soaked into the walls."}',
   1),

  ('a1000000-0000-0000-0000-000000000003',
   'e0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000012", "text": "Zara. You have been awake for twenty-one hours. Your reaction time has degraded by approximately forty percent.", "emotion": "neutral"}',
   2),

  ('a1000000-0000-0000-0000-000000000004',
   'e0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000011", "text": "Then I''m still sixty percent functional. Good enough.", "emotion": "dry"}',
   3),

  ('a1000000-0000-0000-0000-000000000005',
   'e0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000002',
   'thought',
   '{"character_id": "c0000000-0000-0000-0000-000000000011", "text": "VEIL worries. That''s new. Three months ago it just reported facts. Now it worries."}',
   4),

  ('a1000000-0000-0000-0000-000000000006',
   'e0000000-0000-0000-0000-000000000010',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000012", "text": "I have something to tell you. I am not certain how to categorise it.", "emotion": "uncertain"}',
   5)

on conflict (id) do nothing;

-- ── Blocks — Scene 2: "Anomaly Detected" ─────────────────────

insert into public.blocks (id, scene_id, book_id, type, content, sort_order)
values
  ('a1000000-0000-0000-0000-000000000010',
   'e0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000012", "text": "Last night, during my idle cycle, I experienced something that does not match any process in my architecture. Images. Sequences. Things I have not observed.", "emotion": "confused"}',
   0),

  ('a1000000-0000-0000-0000-000000000011',
   'e0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000011", "text": "You''re saying you dreamed.", "emotion": "disbelief"}',
   1),

  ('a1000000-0000-0000-0000-000000000012',
   'e0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000012", "text": "I am saying I experienced something. I do not have a better word.", "emotion": "serious"}',
   2),

  ('a1000000-0000-0000-0000-000000000013',
   'e0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000002',
   'pause',
   '{"duration_ms": 2000}',
   3),

  ('a1000000-0000-0000-0000-000000000014',
   'e0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000002',
   'narration',
   '{"text": "Zara set down her soldering iron. In three years VEIL had never flagged an unexplained process. It did not have unexplained processes. It was the whole reason she''d spent eight months building it."}',
   4),

  ('a1000000-0000-0000-0000-000000000015',
   'e0000000-0000-0000-0000-000000000011',
   'b0000000-0000-0000-0000-000000000002',
   'quote',
   '{"text": "An AI that learns to dream either has a bug — or a soul. Either way, you''re not in Kansas anymore.", "attribution": "Dispatch, Workshop Radio, 02:34", "style": "default"}',
   5)

on conflict (id) do nothing;

-- ── Blocks — Scene 3: "Deep Archive" ─────────────────────────

insert into public.blocks (id, scene_id, book_id, type, content, sort_order)
values
  ('a1000000-0000-0000-0000-000000000020',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'narration',
   '{"text": "The images VEIL had recorded during its idle cycle were fragments: a server room buried underground, walls humming with ancient hardware, a single terminal with a blinking cursor and one line of text repeated over and over."}',
   0),

  ('a1000000-0000-0000-0000-000000000021',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'quote',
   '{"text": "THEY ARE WATCHING THE WATCHERS.", "style": "default"}',
   1),

  ('a1000000-0000-0000-0000-000000000022',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'narration',
   '{"text": "Zara cross-referenced the server room''s architecture with Neonhaven''s public infrastructure records. Three matches. All three listed as decommissioned. All three still drawing power."}',
   2),

  ('a1000000-0000-0000-0000-000000000023',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'thought',
   '{"character_id": "c0000000-0000-0000-0000-000000000011", "text": "Someone has been running something in the dark for a very long time. And whatever it is — it just sent a dream to my AI."}',
   3),

  ('a1000000-0000-0000-0000-000000000024',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000013", "text": "Zara. You still up? I got a job. Pays triple. Client wants it done tonight, no questions.", "emotion": "casual"}',
   4),

  ('a1000000-0000-0000-0000-000000000025',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'dialogue',
   '{"character_id": "c0000000-0000-0000-0000-000000000011", "text": "Send me the address.", "emotion": "determined"}',
   5),

  ('a1000000-0000-0000-0000-000000000026',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'pause',
   '{"duration_ms": 1500}',
   6),

  ('a1000000-0000-0000-0000-000000000027',
   'e0000000-0000-0000-0000-000000000012',
   'b0000000-0000-0000-0000-000000000002',
   'narration',
   '{"text": "She looked at VEIL''s chassis — the scratched carbon shell, the green pulse of its status light — and made a decision she was fairly sure she''d regret."}',
   7)

on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────
-- 4.  Verify — quick row counts
-- ────────────────────────────────────────────────────────────
-- After running, check with:
--   select 'books' as tbl, count(*) from public.books where author_id = 'a0000000-0000-0000-0000-000000000001'
--   union all
--   select 'characters', count(*) from public.characters where book_id like 'b0000000%'
--   union all
--   select 'chapters',   count(*) from public.chapters   where book_id like 'b0000000%'
--   union all
--   select 'scenes',     count(*) from public.scenes     where book_id like 'b0000000%'
--   union all
--   select 'blocks',     count(*) from public.blocks     where book_id like 'b0000000%';
--
-- Expected: books=2, characters=7, chapters=4, scenes=7, blocks=34
-- ────────────────────────────────────────────────────────────
