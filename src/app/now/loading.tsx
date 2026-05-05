import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { Activity } from 'lucide-react'

export default function NowLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
            <Activity className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>

        {/* Sentiment bar */}
        <Skeleton className="h-24 rounded-2xl mb-6" />

        {/* Latest law */}
        <Skeleton className="h-24 rounded-2xl mb-8" />

        {/* Sections */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-8">
            <Skeleton className="h-4 w-40 mb-3" />
            <div className="space-y-2">
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
