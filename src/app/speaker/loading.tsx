import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SpeakerLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 pb-24">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
          <div className="mb-8 border-b-2 border-surface-300 pb-6">
            <Skeleton className="h-7 w-56 mb-2" />
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-12 mb-4" />
                <Skeleton className="h-32 rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
