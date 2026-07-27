import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CreateRelayLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-72 mb-8" />

        {/* Form fields */}
        <div className="space-y-6">
          {/* Topic picker */}
          <div>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Side selector */}
          <div>
            <Skeleton className="h-3 w-16 mb-2" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>

          {/* Opening argument */}
          <div>
            <Skeleton className="h-3 w-32 mb-2" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>

          {/* Invite */}
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
