import { Skeleton } from '@/components/ui/Skeleton'

export default function EquilibriumLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* TopBar skeleton */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg flex-shrink-0" />
        </div>

        {/* Score card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Skeleton className="h-28 w-40 rounded-xl flex-shrink-0" />
            <div className="flex-1 w-full space-y-3">
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-3 space-y-1.5">
                    <Skeleton className="h-4 w-4 mx-auto rounded" />
                    <Skeleton className="h-5 w-8 mx-auto" />
                    <Skeleton className="h-2.5 w-12 mx-auto" />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Skeleton className="flex-1 h-9 rounded-lg" />
                <Skeleton className="flex-1 h-9 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Category grid */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-200 border border-surface-300 p-3 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* Topic lists */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="flex border-b border-surface-300">
            <div className="flex-1 px-4 py-3"><Skeleton className="h-4 w-24 mx-auto" /></div>
            <div className="flex-1 px-4 py-3"><Skeleton className="h-4 w-24 mx-auto" /></div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-surface-300/50">
              <Skeleton className="h-3 w-4 flex-shrink-0" />
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
