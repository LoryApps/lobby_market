import { Scale } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CommitteesLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <div className="border-b border-surface-300/50 bg-surface-100/80">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-for-500/10 border border-for-500/30 flex items-center justify-center flex-shrink-0">
              <Scale className="w-6 h-6 text-for-400/50" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl mb-3" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full flex-shrink-0" />)}
          </div>
        </div>
      </div>
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
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
