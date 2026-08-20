import { Skeleton } from '@/components/ui/Skeleton'

export default function ClimateLoading() {
  return (
    <div className="min-h-screen bg-surface-100 pb-20">
      <div className="h-14 bg-surface-200 border-b border-surface-300" />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  )
}
