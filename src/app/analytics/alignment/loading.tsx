import { Skeleton } from '@/components/ui/Skeleton'

export default function AlignmentLoading() {
  return (
    <div className="min-h-screen bg-surface-50 p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-surface-300 bg-surface-200/50">
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-300/50 last:border-0">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-6 w-12 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
