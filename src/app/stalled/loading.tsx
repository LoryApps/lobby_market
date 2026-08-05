import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function StalledLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-11 w-52" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
