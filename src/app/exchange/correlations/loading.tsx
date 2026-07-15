import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50 pt-20 pb-24 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-1 mt-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-1">
              <Skeleton className="h-10 w-40" />
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-10 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
