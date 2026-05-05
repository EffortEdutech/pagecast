import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data: book } = await supabase
    .from('books')
    .select('title, description')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!book) {
    return { title: 'Book — PageCast' }
  }

  return {
    title: `${book.title} — PageCast`,
    description: book.description ?? 'A cinematic audio storybook on PageCast.',
    openGraph: {
      title: `${book.title} — PageCast`,
      description: book.description ?? 'A cinematic audio storybook on PageCast.',
      type: 'book',
    },
  }
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
