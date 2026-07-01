import { Skeleton } from '@/components/ui/Skeleton'

export default function LegacyLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
        <Skeleton className="h-6 w-24" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
