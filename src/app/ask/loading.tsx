import { Skeleton } from '@/components/ui/Skeleton'

export default function AskLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      {/* TopBar placeholder */}
      <div className="h-14 border-b border-surface-300 bg-surface-100" />

      <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4 py-12 gap-8">
        {/* Icon + title */}
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="space-y-2 flex flex-col items-center">
            <Skeleton className="h-7 w-36 rounded-lg" />
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
        </div>

        {/* Suggestion cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
