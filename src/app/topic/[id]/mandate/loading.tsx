import { Skeleton } from '@/components/ui/Skeleton'

export default function MandateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="h-16 bg-surface-100 border-b border-surface-300" />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-52 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </main>
    </div>
  )
}
