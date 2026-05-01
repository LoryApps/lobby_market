import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function CapsuleSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
      </div>
      {/* Preview text */}
      <div className="px-4 pb-3 space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      {/* Stats row */}
      <div className="px-4 py-3 border-t border-surface-200/50 flex items-center gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-24 rounded-lg ml-auto" />
      </div>
    </div>
  )
}

export default function CapsuleLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-xl flex-shrink-0" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center space-y-1.5">
              <Skeleton className="h-7 w-10 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-surface-200/50 rounded-xl mb-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
          ))}
        </div>

        {/* Capsule cards */}
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <CapsuleSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
