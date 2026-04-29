import { BarChart2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SpectrumLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <BarChart2 className="h-5 w-5 text-purple" />
          </div>
          <div className="space-y-1.5 flex-1 max-w-lg">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-5">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-18 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-18 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>

        {/* Scatter plot canvas area */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="relative w-full" style={{ paddingBottom: '62%' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid grid-cols-6 gap-4 w-full h-full p-8 opacity-40">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full bg-surface-300 animate-pulse"
                    style={{
                      width: 8 + (i % 5) * 4,
                      height: 8 + (i % 5) * 4,
                      marginTop: (i * 7) % 40,
                      marginLeft: (i * 11) % 30,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Axis labels */}
        <div className="flex items-center justify-between mt-3 px-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
