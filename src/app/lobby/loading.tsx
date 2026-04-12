import { Megaphone } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LobbyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Megaphone className="h-5 w-5 text-for-400" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Lobby cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />

                <div className="flex-1 min-w-0 space-y-2.5">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>

                  {/* Member avatars */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <Skeleton key={j} className="h-6 w-6 rounded-full flex-shrink-0" />
                    ))}
                    <Skeleton className="h-3 w-16 ml-1" />
                  </div>
                </div>

                <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
