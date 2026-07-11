import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicFilibusterLoading() {
  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <div className="h-14 bg-surface-200/50 border-b border-surface-300/40" />
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        <Skeleton className="h-4 w-64" />
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  )
}
