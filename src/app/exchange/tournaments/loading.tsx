import { Skeleton } from '@/components/ui/Skeleton'

export default function TournamentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pt-16">
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-7 w-56" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-5 w-64 mb-2" />
            <Skeleton className="h-3 w-80 mb-4" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
