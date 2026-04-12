import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LobbyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <div className="mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>

        {/* Lobby header card */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-5 space-y-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-xl flex-shrink-0" />
          </div>

          {/* Description */}
          <div className="space-y-2 pt-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-200 p-3 space-y-1.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        </div>

        {/* Topic section */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="rounded-xl bg-surface-200 p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full rounded-full mt-3" />
          </div>
        </div>

        {/* Members section */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>

          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-t border-surface-300 first:border-0">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
