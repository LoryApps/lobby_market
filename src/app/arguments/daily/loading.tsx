import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ArgumentDailyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Main argument card */}
        <div className="rounded-2xl bg-surface-100 border border-gold/30 p-6 space-y-4">
          {/* Quote icon + badge */}
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>

          {/* Author row */}
          <div className="flex items-center gap-3 pt-2 border-t border-surface-300">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        </div>

        {/* Topic context */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
        </div>

        {/* Actions row */}
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>

        {/* Counter-argument section */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Yesterday's pick teaser */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
