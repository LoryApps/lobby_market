import { Brain } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicRecallLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
            <Brain className="h-5 w-5 text-purple" />
          </div>
          <div>
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-3.5 w-52 rounded mt-1.5" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
