import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateIntelligenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* TopBar placeholder */}
      <div className="sticky top-0 z-50 h-14 bg-surface-100 border-b border-surface-300" />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          {/* Upcoming */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
