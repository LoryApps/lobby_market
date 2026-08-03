import { Skeleton } from '@/components/ui/Skeleton'

export default function VerdictsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 h-14 bg-surface-100/95 border-b border-surface-300" />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
