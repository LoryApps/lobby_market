import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionNetworkLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <Skeleton className="h-9 w-9 rounded-lg mb-5" />
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <Skeleton className="w-full rounded-xl" style={{ minHeight: '480px' }} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
