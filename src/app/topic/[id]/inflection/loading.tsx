import { Skeleton } from '@/components/ui/Skeleton'

export default function InflectionLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-5">
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-2 w-14" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-2 w-10" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
              <div className="px-5 py-4 bg-surface-200/60 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((j) => (
                    <div key={j} className="rounded-xl p-3 bg-surface-200/60 space-y-1.5">
                      <Skeleton className="h-2 w-12" />
                      <Skeleton className="h-7 w-14" />
                      <Skeleton className="h-2 w-8" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="px-5 pb-5 space-y-2">
                <Skeleton className="h-2 w-40" />
                <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
