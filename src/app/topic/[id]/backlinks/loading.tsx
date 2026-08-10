import { Skeleton } from '@/components/ui/Skeleton'

export default function BacklinksLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 gap-3 flex-shrink-0">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-surface-100 border border-surface-300 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </main>
    </div>
  )
}
