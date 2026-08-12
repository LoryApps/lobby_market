import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotesGraphClient } from './NotesGraphClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Notes Graph · Lobby Market',
  description:
    'A visual knowledge graph of your civic notes — see how your private research connects across topics. Nodes are notes; circles are the topics they annotate.',
  robots: { index: false },
}

export default async function NotesGraphPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <NotesGraphClient />
}
