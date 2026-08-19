import { Skeleton } from '@/components/ui/Skeleton'

export default function ThesisAlignmentLoading() {
  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col">
      <div className="h-14 bg-surface-900 border-b border-surface-800" />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-28 space-y-6">
        <Skeleton className="h-4 w-28 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
