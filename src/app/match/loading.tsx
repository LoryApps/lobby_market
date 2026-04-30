import { Skeleton } from '@/components/ui/Skeleton'

export default function MatchLoading() {
  return (
    <div className="min-h-screen bg-surface-50 p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 mt-8">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-xl mb-6" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
  )
}
