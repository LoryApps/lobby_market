import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NetworkLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="flex items-center justify-center pt-32">
        <div className="h-6 w-6 rounded-full border-2 border-for-500 border-t-transparent animate-spin" />
      </div>
      <BottomNav />
    </div>
  )
}
