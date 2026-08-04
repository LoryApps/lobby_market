import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ProposeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl mt-2" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
