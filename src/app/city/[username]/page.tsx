import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CityViewClient } from '@/components/city/CityViewClient'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LIMIT = 100

interface CityUsernamePageProps {
  params: { username: string }
}

export default async function CityUsernamePage({
  params,
}: CityUsernamePageProps) {
  const supabase = await createClient()

  // Fetch the focus profile
  const { data: focusProfile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .maybeSingle()) as { data: Profile | null }

  if (!focusProfile) {
    notFound()
  }

  // Top users by reputation
  const { data: users } = (await supabase
    .from('profiles')
    .select('*')
    .order('reputation_score', { ascending: false })
    .limit(LIMIT)) as { data: Profile[] | null }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let currentUser: Profile | null = null
  if (user) {
    const { data } = (await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()) as { data: Profile | null }
    currentUser = data
  }

  const list = users ?? []
  // Ensure both the focus user and the current user are present
  if (!list.some((u) => u.id === focusProfile.id)) {
    list.push(focusProfile)
  }
  if (currentUser && !list.some((u) => u.id === currentUser!.id)) {
    list.push(currentUser)
  }

  return (
    <CityViewClient
      users={list}
      currentUser={currentUser}
      focusUsername={params.username}
    />
  )
}
