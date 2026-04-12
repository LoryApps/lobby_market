import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ReportQueue } from '@/components/moderation/ReportQueue'
import { ModerationStats } from '@/components/moderation/ModerationStats'
import { cn } from '@/lib/utils/cn'

export const metadata = {
  title: 'Moderation · Lobby Market',
  description: 'Troll Catcher report queue and moderation stats.',
}

export const dynamic = 'force-dynamic'

const MODERATOR_ROLES = ['troll_catcher', 'elder'] as const

export default async function ModerationPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isModerator =
    !!profile && (MODERATOR_ROLES as readonly string[]).includes(profile.role)

  if (!isModerator) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-12 pb-24 md:pb-12">
          <div className="rounded-2xl border border-emerald/30 bg-surface-100 p-8 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-emerald/10 text-emerald mx-auto mb-4">
              <Shield className="h-7 w-7" />
            </div>
            <h1 className="font-mono text-2xl font-bold text-white mb-2">
              Moderation is Troll Catcher-only
            </h1>
            <p className="font-mono text-sm text-surface-500 max-w-prose mx-auto mb-6">
              Work through the 20-case training module to earn the
              certification and unlock the queue.
            </p>
            <Link
              href="/moderation/training"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-emerald/10 border border-emerald/30 text-emerald',
                'hover:bg-emerald/20 text-sm font-mono font-medium transition-colors'
              )}
            >
              <Target className="h-4 w-4" />
              Start Training
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const [{ count: pending }, { count: resolved }, { count: dismissed }, { count: escalated }] =
    await Promise.all([
      supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved'),
      supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'dismissed'),
      supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'escalated'),
    ])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald/10 border border-emerald/30">
              <Shield className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Moderation
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Troll Catcher report queue
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <ModerationStats
            pendingCount={pending ?? 0}
            resolvedCount={resolved ?? 0}
            dismissedCount={dismissed ?? 0}
            escalatedCount={escalated ?? 0}
          />
        </div>

        <ReportQueue />
      </main>

      <BottomNav />
    </div>
  )
}
