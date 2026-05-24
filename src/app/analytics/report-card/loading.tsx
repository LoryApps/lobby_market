import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function ReportCardLoading() {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <Skel className="h-32 rounded-2xl" />
        {[...Array(6)].map((_, i) => (
          <Skel key={i} className="h-20 rounded-xl" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
