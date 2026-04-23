import { Layers } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function CollectionCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      </div>
      {/* Badges row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full ml-auto" />
      </div>
    </div>
  )
}

export default function CollectionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Layers className="h-5 w-5 text-for-400" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-xl flex-shrink-0" />
        </div>

        {/* Collection list */}
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <CollectionCardSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
