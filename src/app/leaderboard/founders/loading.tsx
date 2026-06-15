import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 px-4 pt-16 pb-28 max-w-2xl mx-auto">
      <Skeleton className="h-5 w-24 mb-5 rounded-lg" />
      <Skeleton className="h-8 w-52 mb-2 rounded-xl" />
      <Skeleton className="h-4 w-80 mb-6 rounded" />
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
