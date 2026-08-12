import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CartographyLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-surface-400 border-t-for-400 rounded-full animate-spin" />
      </div>
      <BottomNav />
    </div>
  )
}
