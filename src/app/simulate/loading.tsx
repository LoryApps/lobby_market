import { FlaskConical } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SimulateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <FlaskConical className="h-5 w-5 text-emerald" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>

        {/* Config panels */}
        <div className="space-y-3 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 w-40" />
                <div className="ml-auto">
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
              </div>
              {i === 0 && (
                <div className="px-5 pb-4 space-y-3 border-t border-surface-300 pt-4">
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((j) => (
                      <Skeleton key={j} className="h-20 rounded-xl" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Run simulation button */}
        <Skeleton className="h-12 w-full rounded-xl mb-8" />

        {/* Results placeholder */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-14" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
