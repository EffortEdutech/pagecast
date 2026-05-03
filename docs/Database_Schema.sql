-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL,
  book_id uuid,
  type USER-DEFINED NOT NULL,
  filename text NOT NULL,
  url text NOT NULL,
  size_bytes bigint,
  mime_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id),
  CONSTRAINT assets_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.blocks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  scene_id uuid NOT NULL,
  book_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blocks_pkey PRIMARY KEY (id),
  CONSTRAINT blocks_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.scenes(id),
  CONSTRAINT blocks_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.books (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  cover_gradient text DEFAULT 'from-purple-900 to-blue-900'::text,
  cover_emoji text DEFAULT '📖'::text,
  genre text,
  age_rating text DEFAULT 'All ages'::text,
  tags ARRAY DEFAULT '{}'::text[],
  status USER-DEFINED NOT NULL DEFAULT 'draft'::book_status,
  price numeric NOT NULL DEFAULT 0.00,
  is_free boolean NOT NULL DEFAULT true,
  total_chapters integer NOT NULL DEFAULT 0,
  estimated_time text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT books_pkey PRIMARY KEY (id),
  CONSTRAINT books_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.chapters (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  book_id uuid NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chapters_pkey PRIMARY KEY (id),
  CONSTRAINT chapters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.characters (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  book_id uuid NOT NULL,
  name text NOT NULL,
  role text,
  color text DEFAULT '#5C5A6A'::text,
  voice_label text,
  voice_pitch numeric DEFAULT 1.0,
  voice_rate numeric DEFAULT 1.0,
  avatar_emoji text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT characters_pkey PRIMARY KEY (id),
  CONSTRAINT characters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  role USER-DEFINED NOT NULL DEFAULT 'reader'::user_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.purchases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL,
  price_paid numeric NOT NULL DEFAULT 0.00,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchases_pkey PRIMARY KEY (id),
  CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT purchases_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.reading_progress (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL,
  chapter_idx integer NOT NULL DEFAULT 0,
  scene_idx integer NOT NULL DEFAULT 0,
  block_idx integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reading_progress_pkey PRIMARY KEY (id),
  CONSTRAINT reading_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT reading_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);
CREATE TABLE public.scenes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chapter_id uuid NOT NULL,
  book_id uuid NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT scenes_pkey PRIMARY KEY (id),
  CONSTRAINT scenes_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id),
  CONSTRAINT scenes_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id)
);