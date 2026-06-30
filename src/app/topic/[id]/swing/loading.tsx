import { Skeleton } from '@/components/ui/Skeleton'

export default function SwingLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-2 w-10" />
              </div>
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5 mt-1" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
