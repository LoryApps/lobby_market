import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { NotificationsClient } from '@/components/notifications/NotificationsClient'
import type { Notification } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notifications · Lobby Market',
  description: 'Your latest updates from the Lobby — votes, debates, laws, and achievements.',
  openGraph: {
    title: 'Notifications · Lobby Market',
    description: 'Stay up to date with activity across your Lobby debates and topics.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default async function NotificationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data } = (await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)) as { data: Notification[] | null }

  const notifications = data ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <NotificationsClient
          initialNotifications={notifications}
          userId={user.id}
        />
      </main>
      <BottomNav />
    </div>
  )
}
