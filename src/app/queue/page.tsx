import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueueClient } from './QueueClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Action Queue · Lobby Market',
  description:
    'Your personalised civic to-do list — urgent votes, arguments to write, debates to RSVP, and predictions to make. Know exactly what to do next.',
  robots: { index: false },
  openGraph: {
    title: 'Action Queue · Lobby Market',
    description: 'Your personalised civic to-do list. Never wonder what to do next.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default async function QueuePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <QueueClient />
      </main>
      <BottomNav />
    </div>
  )
}
