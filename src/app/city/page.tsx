import { createClient } from '@/lib/supabase/server'
import { CityViewClient } from '@/components/city/CityViewClient'
import type { Profile } from '@/lib/supabase/types'
import { SAMPLE_CITY_USERS } from '@/lib/city/sample-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LIMIT = 100

export default async function CityPage() {
  const supabase = await createClient()

  // Attempt to fetch real profiles — swallow errors so a broken DB
  // (no migrations, offline Supabase, etc.) falls through to sample data.
  let users: Profile[] = []
  let currentUser: Profile | null = null

  try {
    const { data, error } = (await supabase
      .from('profiles')
      .select('*')
      .order('reputation_score', { ascending: false })
      .limit(LIMIT)) as { data: Profile[] | null; error: unknown }
    if (!error && data) users = data

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: me } = (await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()) as { data: Profile | null }
      currentUser = me
    }
  } catch {
    // Silent fallback — sample data below
  }

  // Fallback: if DB has no profiles, demo the city with seeded samples.
  if (users.length === 0) {
    users = SAMPLE_CITY_USERS
  }

  // Make sure the current user is always in the list so their plot renders
  // even if they're below the top-100 reputation cut.
  if (currentUser && !users.some((u) => u.id === currentUser!.id)) {
    users.push(currentUser)
  }

  return <CityViewClient users={users} currentUser={currentUser} />
}
