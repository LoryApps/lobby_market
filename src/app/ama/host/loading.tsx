import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14 space-y-4">
        <Skeleton className="h-4 w-32 mb-6" />

        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>

        {/* Form fields */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}

        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <BottomNav />
    </div>
  )
}
