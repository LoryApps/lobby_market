import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BountiesLoading() {
  return (
    <>
      <div className="min-h-screen bg-surface-50 pb-24">
        <TopBar />
        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
          <div className="h-8 w-48 bg-surface-300/50 rounded-xl animate-pulse" />
          <div className="h-4 w-full bg-surface-300/30 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-surface-300/30 rounded-2xl animate-pulse" />
            <div className="h-20 bg-surface-300/30 rounded-2xl animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-surface-300/20 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
      <BottomNav />
    </>
  )
}
