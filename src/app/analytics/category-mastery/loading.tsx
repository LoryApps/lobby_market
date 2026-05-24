import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { Trophy } from 'lucide-react'

export default function CategoryMasteryLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0 mt-0.5" />
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </div>

        {/* Stats strip skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 space-y-1.5">
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Category cards skeleton */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-6 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
