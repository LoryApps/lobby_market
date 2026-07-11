import { Skeleton } from '@/components/ui/Skeleton'

export default function DelegationLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 bg-surface-50/80 backdrop-blur border-b border-surface-200 px-4 py-3 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
