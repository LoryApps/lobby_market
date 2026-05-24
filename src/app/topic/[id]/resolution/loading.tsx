import { Skeleton } from '@/components/ui/Skeleton'

export default function ResolutionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100" />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-3 w-full rounded-full mt-4" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
