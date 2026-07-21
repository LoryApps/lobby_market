import { Skeleton } from '@/components/ui/Skeleton'

export default function ConflictsLoading() {
  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-28">
        <Skeleton className="h-4 w-24 mb-6" />
        <Skeleton className="h-7 w-56 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-3/4 mb-6" />
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
