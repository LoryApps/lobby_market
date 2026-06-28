import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-50 text-white">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-5">
        <Skeleton className="h-4 w-20 mb-6" />
        <Skeleton className="h-40 w-full rounded-2xl mb-6" />
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <Skeleton className="h-20 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
