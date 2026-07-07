import { Shield } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AccountabilityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Skeleton className="h-4 w-28 mb-4" />
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Shield className="h-5 w-5 text-gold/60" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </div>

        {/* Refresh row */}
        <div className="flex justify-end mb-4">
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Value breakdown */}
        <div className="rounded-xl border border-surface-200 bg-surface-100 p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-24 flex-shrink-0" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-3 w-12 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Sort + filter controls */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 overflow-hidden">
            {[48, 60, 56, 64, 52].map((w, i) => (
              <Skeleton key={i} className="h-6 rounded-full flex-shrink-0" style={{ width: w }} />
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            <Skeleton className="h-3.5 w-8 flex-shrink-0" />
            {[80, 64, 72, 68, 60].map((w, i) => (
              <Skeleton key={i} className="h-6 rounded-full flex-shrink-0" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Holder row skeletons */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-surface-200 bg-surface-100 px-3 py-2.5"
            >
              <Skeleton className="h-6 w-6 flex-shrink-0" />
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                <div className="space-y-1 text-center">
                  <Skeleton className="h-4 w-8 mx-auto" />
                  <Skeleton className="h-2.5 w-6 mx-auto" />
                </div>
                <div className="space-y-1 text-center">
                  <Skeleton className="h-4 w-6 mx-auto" />
                  <Skeleton className="h-2.5 w-6 mx-auto" />
                </div>
              </div>
              <Skeleton className="h-4 w-4 flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
