'use client'

import nextDynamic from 'next/dynamic'
import type { Profile } from '@/lib/supabase/types'

const CityView = nextDynamic(
  () => import('./CityView').then((m) => m.CityView),
  {
    ssr: false,
    loading: () => <CityLoader />,
  }
)

export interface CityViewClientProps {
  users: Profile[]
  currentUser: Profile | null
  focusUsername?: string
}

export function CityViewClient(props: CityViewClientProps) {
  return <CityView {...props} />
}

function CityLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-4 inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-full border border-white/20 bg-white/5">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
        <div className="text-sm tracking-widest text-white/60">
          ENTERING THE LOBBY...
        </div>
      </div>
    </div>
  )
}
