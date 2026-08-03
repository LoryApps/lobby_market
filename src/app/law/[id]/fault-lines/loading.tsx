import { Skeleton } from '@/components/ui/Skeleton'

export default function LawFaultLinesLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
