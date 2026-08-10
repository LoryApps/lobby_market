import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateHubLoading() {
  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-surface-50">
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <div className="flex items-start gap-3 mb-6">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/60 border border-surface-300/50"
              >
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      <BottomNav />
    </>
  )
}
