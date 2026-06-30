import { Skeleton } from '@/components/ui/Skeleton'

export default function HeatLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1">
                <Skeleton className="h-2 w-14" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-12 flex-shrink-0" />
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-3 w-10 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
