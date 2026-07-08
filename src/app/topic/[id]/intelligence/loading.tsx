import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function IntelligenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back link */}
        <Skeleton className="h-4 w-28 mb-5" />

        {/* Header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>

        {/* Intel Score + Law Probability */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Signal breakdown */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex items-start gap-3 mb-4">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50">
                <Skeleton className="h-6 w-6 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-8 flex-shrink-0" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top contributors */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-start gap-3 mb-4">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <Skeleton className="h-3 w-4 flex-shrink-0" />
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
