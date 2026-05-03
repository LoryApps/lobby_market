import { Skeleton } from '@/components/ui/Skeleton'

export default function PromptArchiveLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-6xl mx-auto px-4 py-6 pb-28 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
