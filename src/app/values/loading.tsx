import { Brain } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function ValueCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100/80 p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-3">
        {/* Spectrum badge */}
        <Skeleton className="flex-shrink-0 h-10 w-10 rounded-xl" />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Name + strength */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-8" />
          </div>
          {/* Tagline */}
          <Skeleton className="h-3.5 w-full" />
          {/* Category pills */}
          <div className="flex gap-1">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        </div>

        <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
      </div>

      {/* Law count bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

export default function ValuesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Brain className="h-5 w-5 text-purple" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
        </div>

        {/* Summary card */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-4/5" />
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300 p-3 space-y-1.5">
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-5 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Spectrum filter */}
        <div className="flex gap-2 flex-wrap">
          {[50, 72, 88, 68, 75, 80].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" style={{ width: w }} />
          ))}
        </div>

        {/* Value cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ValueCardSkeleton key={i} />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
