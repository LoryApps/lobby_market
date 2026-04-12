import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TrainingModule } from '@/components/moderation/TrainingModule'
import type { TrollCatcherTraining } from '@/lib/supabase/types'

export const metadata = {
  title: 'Moderation Training · Lobby Market',
  description: 'Complete 20 cases to become a certified Troll Catcher.',
}

export const dynamic = 'force-dynamic'

export default async function TrainingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: training } = await supabase
    .from('troll_catcher_training')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/moderation"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-medium text-white">
            Troll Catcher Training
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <TrainingModule
          initialTraining={(training as TrollCatcherTraining | null) ?? null}
        />
      </div>
    </div>
  )
}
