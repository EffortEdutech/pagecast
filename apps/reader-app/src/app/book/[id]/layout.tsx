import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

// generateMetadata calls createClient() from @supabase/ssr (server).
// force-dynamic prevents Next.js from trying to statically prerender this route.
export const dynamic = 'force-dynamic'

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
    return { title: 'Cast - PageCast' }
  }

  return {
    title: `${book.title} - PageCast Cast`,
    description: book.description ?? 'A PageCast experience with voices, scenes, and gentle magic.',
    openGraph: {
      title: `${book.title} - PageCast Cast`,
      description: book.description ?? 'A PageCast experience with voices, scenes, and gentle magic.',
      type: 'book',
    },
  }
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
