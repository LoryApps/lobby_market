import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { NotificationsList } from '@/components/profile/NotificationsList'
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
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Bell className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Notifications
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} unread · ${notifications.length} total`
                  : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        <NotificationsList notifications={notifications} />
      </main>
      <BottomNav />
    </div>
  )
}
