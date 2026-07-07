import type { Metadata } from 'next'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { UnsubscribeClient } from './UnsubscribeClient'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unsubscribe · Lobby Market Newsletter',
  description: 'Unsubscribe from The Civic Brief newsletter.',
}

export default async function UnsubscribePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userEmail: string | null = null
  if (user) {
    userEmail = user.email ?? null
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />
      <main className="flex-1 pt-14 pb-20">
        <UnsubscribeClient userEmail={userEmail} />
      </main>
      <BottomNav />
    </div>
  )
}
