import { Skeleton } from '@/components/ui/Skeleton'

export default function CensusLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <div className="h-14 bg-surface-200 border-b border-surface-300/50" />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          </div>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
