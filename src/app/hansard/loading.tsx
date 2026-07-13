import { Skeleton } from '@/components/ui/Skeleton'

export default function HansardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100/80 border-b border-surface-300/50" />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="flex gap-3 mb-6">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
        <div className="space-y-6">
          {[0, 1].map((d) => (
            <div key={d}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-4 w-48" />
                <div className="flex-1 h-px bg-surface-300/30" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-100/60 p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full max-w-lg" />
                        <Skeleton className="h-3 w-full max-w-md" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
