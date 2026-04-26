import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function OracleLoading() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-40 mb-3" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="space-y-8">
          {[0, 1, 2].map((s) => (
            <div key={s}>
              <Skeleton className="h-4 w-36 mb-4" />
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="border border-surface-200 rounded-xl p-4 space-y-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
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
