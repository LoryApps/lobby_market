import { Brain } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SteelmanLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30">
                <Brain className="h-5 w-5 text-purple" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-3 w-40 mx-auto" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
