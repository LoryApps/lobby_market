import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicVetoesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-3xl mx-auto px-4 pt-20 pb-24 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
