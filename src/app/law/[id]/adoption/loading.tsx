import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AdoptionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-60 w-full" />
        <Skeleton className="h-48 w-full" />
      </main>
      <BottomNav />
    </div>
  )
}
