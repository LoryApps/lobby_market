import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { InboxClient } from './InboxClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Messages · Lobby Market',
  description: 'Direct messages with fellow citizens — coordinate coalitions, challenge debaters, follow up on arguments.',
  robots: { index: false },
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
            <MessageSquare className="h-5 w-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Messages</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">Private conversations</p>
          </div>
        </div>
        <InboxClient />
      </main>
      <BottomNav />
    </div>
  )
}
