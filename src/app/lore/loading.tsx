import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function LawRowSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300">
      <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
    </div>
  )
}

function ArgSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-surface-100 border border-surface-300 space-y-2">
      <div className="flex items-start gap-2.5">
        <Skeleton className="h-3.5 w-5 flex-shrink-0 mt-0.5" />
        <Skeleton className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="h-6 w-12 rounded-lg flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2 pl-7">
        <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

export default function LoreLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-12 w-12 rounded-2xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Records */}
        <div className="mb-8">
          <Skeleton className="h-4 w-36 mb-3 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-32 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Laws */}
        <div className="mb-8">
          <div className="flex justify-between mb-3">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <LawRowSkeleton key={i} />)}
          </div>
        </div>

        {/* Arguments */}
        <div className="mb-8">
          <div className="flex justify-between mb-3">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <ArgSkeleton key={i} />)}
          </div>
        </div>

        {/* Citizens */}
        <div className="mb-8">
          <Skeleton className="h-4 w-40 mb-3 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
                <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
                <div className="flex items-center gap-2.5 flex-1">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <Skeleton className="h-3.5 w-12 ml-auto" />
                  <Skeleton className="h-3 w-16 ml-auto rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
