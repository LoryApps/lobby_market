import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayDigestLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />

        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              <Skeleton className="h-4 w-full mb-1.5" />
              <Skeleton className="h-4 w-5/6 mb-3" />
              <div className="flex -space-x-1.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-6 rounded-full ring-2 ring-surface-50" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
