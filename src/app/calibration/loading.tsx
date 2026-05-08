import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/60 ${className ?? ''}`} />
}

export default function CalibrationLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Sk className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Sk className="h-6 w-32" />
            <Sk className="h-3 w-52" />
          </div>
        </div>
        <Sk className="h-4 w-36 mb-8" />
        <Sk className="h-40 rounded-2xl mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-24 rounded-xl" />)}
        </div>
        <Sk className="h-56 rounded-xl mb-6" />
        <Sk className="h-48 rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
