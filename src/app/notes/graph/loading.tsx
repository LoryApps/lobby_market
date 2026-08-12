import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-surface-500 font-mono text-sm animate-pulse">Building graph…</div>
      </div>
      <BottomNav />
    </div>
  )
}
