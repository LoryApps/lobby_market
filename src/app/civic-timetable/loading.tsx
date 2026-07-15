'use client'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TimetableLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-8 w-56 mb-1" />
        <Skeleton className="h-4 w-80 mb-8" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-8">
            <Skeleton className="h-5 w-40 mb-3" />
            <div className="space-y-3">
              {[1, 2].map((j) => (
                <Skeleton key={j} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
