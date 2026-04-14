import { Megaphone } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LobbyCreateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Megaphone className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        {/* Topic selector */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Position toggle */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 flex-1 rounded-xl" />
          </div>
        </div>

        {/* Name */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Statement / argument */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>

        {/* Evidence links */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-28" />
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            </div>
          ))}
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>

        {/* Submit */}
        <Skeleton className="h-12 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
