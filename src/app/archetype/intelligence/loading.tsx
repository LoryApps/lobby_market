import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArchetypeIntelligenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-56 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex gap-2 mb-8">
          <Skeleton className="h-8 w-52 rounded-xl" />
          <Skeleton className="h-8 w-40 rounded-xl" />
        </div>

        {/* Tendency cards */}
        <Skeleton className="h-5 w-44 rounded-lg mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>

        {/* Divisive topics */}
        <Skeleton className="h-5 w-48 rounded-lg mb-4" />
        <div className="space-y-2 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>

        {/* Unifying topics */}
        <Skeleton className="h-5 w-52 rounded-lg mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
