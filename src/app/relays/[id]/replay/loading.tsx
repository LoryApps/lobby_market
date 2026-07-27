import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayReplayLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Relay title */}
        <Skeleton className="h-6 w-2/3 mb-1" />
        <Skeleton className="h-3 w-40 mb-6" />

        {/* Playback controls */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Argument replay */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`rounded-xl bg-surface-100 border border-surface-300 p-4 ${i % 2 === 0 ? 'opacity-100' : 'opacity-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-12 rounded-full ml-auto" />
              </div>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
