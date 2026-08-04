import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function UnsubscribeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-md mx-auto px-4 py-24 text-center">
        <Skeleton className="h-12 w-12 rounded-2xl mx-auto mb-5" />
        <Skeleton className="h-6 w-56 mx-auto mb-3" />
        <Skeleton className="h-4 w-80 mx-auto mb-2" />
        <Skeleton className="h-4 w-64 mx-auto mb-8" />
        <Skeleton className="h-10 w-36 rounded-xl mx-auto" />
      </main>
      <BottomNav />
    </div>
  )
}
