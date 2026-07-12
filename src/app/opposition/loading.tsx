import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function OppositionLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28 space-y-10">

        {/* Header */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-3/4 max-w-sm" />
        </div>

        {/* Coalition banner */}
        <div className="p-5 rounded-2xl bg-surface-100 border border-surface-300/40 space-y-4">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center space-y-1.5">
                <Skeleton className="h-5 w-10 mx-auto" />
                <Skeleton className="h-3 w-14 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {/* Leader card */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-100 border border-surface-300/40">
                <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-24" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              </div>
            </div>

            {/* Members */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/40">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Counter-programme */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-xl bg-surface-100 border border-surface-300/40 space-y-2">
                    <div className="flex justify-between gap-2">
                      <Skeleton className="h-3.5 flex-1" />
                      <Skeleton className="h-4 w-14 rounded-full flex-shrink-0" />
                    </div>
                    <Skeleton className="h-3.5 w-3/4" />
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
