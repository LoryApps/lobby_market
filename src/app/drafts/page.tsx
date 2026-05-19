import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DraftsClient } from './DraftsClient'
import type { ArgumentDraftWithTopic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Draft Box · Lobby Market',
  description:
    'Your saved argument drafts — refine your thinking before you post. Great arguments deserve great preparation.',
  openGraph: {
    title: 'Draft Box · Lobby Market',
    description: 'Save arguments as drafts. Come back, refine, then post when ready.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default async function DraftsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data } = await supabase
    .from('argument_drafts')
    .select(`
      id,
      user_id,
      topic_id,
      side,
      content,
      created_at,
      updated_at,
      topic:topics ( id, statement, category, status )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  const drafts = (data ?? []) as ArgumentDraftWithTopic[]

  return <DraftsClient drafts={drafts} />
}
