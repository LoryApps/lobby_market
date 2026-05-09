import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Star } from 'lucide-react'

export default function BingoLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Star className="h-5 w-5 text-for-400" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {Array.from({ length: 25 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl min-h-[72px] sm:min-h-[80px]" />
          ))}
        </div>

        {/* Stats skeleton */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
