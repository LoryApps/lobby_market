import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateSnapshotLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-4 w-48 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  )
}
