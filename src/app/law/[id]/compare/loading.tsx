import { Skeleton } from '@/components/ui/Skeleton'

export default function LawCompareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-14 bg-surface-100 border-b border-surface-300" />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>

        {/* Search */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <Skeleton className="h-3 w-36 mb-2" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-12 rounded-lg" />
                <Skeleton className="h-12 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>

        {/* Head to head */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-3 w-24 mx-auto" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
