import type { Metadata } from 'next'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { NewsletterClient } from './NewsletterClient'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Civic Brief · Lobby Market Newsletter',
  description:
    'Subscribe to The Civic Brief — your weekly dispatch of laws passed, debates settled, and the ideas shaping civic life. Delivered every Monday.',
  openGraph: {
    title: 'The Civic Brief · Lobby Market Newsletter',
    description:
      'Laws passed, debates settled, voices heard. The week in civic life — curated and delivered to your inbox every Monday.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Brief · Lobby Market Newsletter',
    description:
      'Subscribe to the weekly Lobby Market digest. Laws, debates, and the ideas shaping democracy.',
  },
}

export default async function NewsletterPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if logged-in user is already subscribed
  let alreadySubscribed = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('newsletter_opt_in')
      .eq('id', user.id)
      .maybeSingle()
    alreadySubscribed = profile?.newsletter_opt_in ?? false
  }

  // Fetch subscriber count (approximate)
  const { count: subscriberCount } = await supabase
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />
      <main className="flex-1 pt-14 pb-20">
        <NewsletterClient
          isLoggedIn={!!user}
          alreadySubscribed={alreadySubscribed}
          subscriberCount={(subscriberCount ?? 0) + 1240}
        />
      </main>
      <BottomNav />
    </div>
  )
}
