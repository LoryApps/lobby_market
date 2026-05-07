import { Loader2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TagGraphLoading() {
  return (
    <div className="h-screen bg-surface-50 flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-for-400 animate-spin mx-auto" />
          <p className="text-sm font-mono text-surface-500">Building tag network…</p>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
