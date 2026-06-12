import { Skeleton } from '@/components/ui/Skeleton'

export default function ForgeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-4">
          <Skeleton className="h-[580px] rounded-2xl" />
          <Skeleton className="h-[580px] rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
