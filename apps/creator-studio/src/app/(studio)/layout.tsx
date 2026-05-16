import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { BooksSync } from '@/components/BooksSync'
import { ConsentGate } from '@/components/ConsentGate'

// This layout calls createClient() from @supabase/ssr (server), which requires
// env vars at runtime. Mark force-dynamic so Next.js never prerenders it.
export const dynamic = 'force-dynamic'

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <BooksSync />
      <ConsentGate />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
