import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function DebateAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Sk className="h-9 w-9 rounded-lg" />
          <Sk className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Sk className="h-4 w-48" />
            <Sk className="h-3 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <Sk key={i} className="h-20 rounded-xl" />)}
        </div>
        <Sk className="h-36 w-full rounded-2xl mb-4" />
        <Sk className="h-40 w-full rounded-2xl mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Sk key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
