import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArgumentDnaLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        {/* Archetype card */}
        <Skeleton className="h-40 w-full rounded-2xl" />
        {/* Radar */}
        <Skeleton className="h-64 w-full rounded-2xl" />
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {/* Arguments */}
        <Skeleton className="h-48 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
