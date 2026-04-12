import { createClient } from '@/lib/supabase/server'
import { CityViewClient } from '@/components/city/CityViewClient'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LIMIT = 100

export default async function CityPage() {
  const supabase = await createClient()

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

  // Make sure the current user is always in the list so their plot renders
  // even if they're below the top-100 reputation cut.
  const list = users ?? []
  if (currentUser && !list.some((u) => u.id === currentUser!.id)) {
    list.push(currentUser)
  }

  return <CityViewClient users={list} currentUser={currentUser} />
}
