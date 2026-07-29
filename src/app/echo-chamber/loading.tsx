import { Skeleton } from '@/components/ui/Skeleton'

export default function EchoChamberLoading() {
  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-4 pt-20 pb-28 space-y-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  )
}
