import { Bookmark } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BookmarkedArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 pb-24 pt-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex-shrink-0">
            <Bookmark className="h-5 w-5 text-gold-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-5">
          <Skeleton className="h-8 w-12 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-16 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-20 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-28 rounded-full flex-shrink-0" />
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3"
            >
              {/* Side badge + author */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <div className="flex items-center gap-1.5 ml-auto">
                  <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              {/* Content lines */}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              {/* Topic chip + upvotes */}
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-5 w-40 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
