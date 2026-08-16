import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SerendipityClient } from './SerendipityClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Civic Serendipity · Lobby Market',
  description:
    'Break your filter bubble. Discover topics, arguments, laws, and citizens from outside your usual categories — curated differently every time.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Serendipity · Lobby Market',
    description:
      "What are you missing? Explore civic debates, arguments, and laws from categories you've never engaged with before.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Serendipity · Lobby Market',
    description: "Break your civic filter bubble — discover what's beyond your usual categories.",
  },
}

export default async function SerendipityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  return <SerendipityClient />
}
