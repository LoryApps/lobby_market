import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function DiscourseLoading() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Sk className="h-9 w-9 rounded-lg" />
          <Sk className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Sk className="h-4 w-44" />
            <Sk className="h-3 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => <Sk key={i} className="h-20 rounded-xl" />)}
        </div>
        <Sk className="h-28 w-full rounded-2xl mb-4" />
        <Sk className="h-44 w-full rounded-2xl mb-4" />
        <Sk className="h-32 w-full rounded-2xl mb-6" />
        <Sk className="h-5 w-32 mb-3" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Sk key={i} className="h-24 rounded-xl" />)}
        </div>
        <Sk className="h-5 w-40 mt-6 mb-3" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Sk key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
