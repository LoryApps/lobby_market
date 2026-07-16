import { Skeleton } from '@/components/ui/Skeleton'

export default function SentimentLoading() {
  return (
    <div className="min-h-screen bg-surface-50 p-4 pt-20 pb-24 max-w-2xl mx-auto">
      <Skeleton className="h-10 w-56 mb-5 rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  )
}
