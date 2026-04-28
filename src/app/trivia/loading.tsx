import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TriviaLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-64 w-full rounded-2xl mb-6" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
