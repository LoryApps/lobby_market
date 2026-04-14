import { Network } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicGraphLoading() {
  return (
    <div className="h-screen bg-surface-50 flex flex-col">
      {/* Header skeleton */}
      <div className="bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 gap-3">
          <div className="h-9 w-9 rounded-lg bg-surface-200 flex-shrink-0 animate-pulse" />
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-surface-500" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>

      {/* Graph area skeleton */}
      <main className="flex-1 overflow-hidden p-3 md:p-5 flex flex-col gap-3">
        {/* Controls row */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Skeleton className="h-9 flex-1 max-w-sm rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* Graph canvas placeholder with simulated nodes */}
        <div className="flex-1 min-h-0 bg-surface-100 border border-surface-300 rounded-xl relative overflow-hidden">
          <Skeleton className="absolute inset-0 rounded-xl opacity-40" />
          {[
            { top: '18%', left: '25%', size: 40 },
            { top: '42%', left: '15%', size: 28 },
            { top: '30%', left: '50%', size: 48 },
            { top: '65%', left: '35%', size: 32 },
            { top: '20%', left: '72%', size: 22 },
            { top: '55%', left: '68%', size: 36 },
            { top: '75%', left: '58%', size: 26 },
            { top: '38%', left: '82%', size: 20 },
            { top: '80%', left: '22%', size: 24 },
          ].map((n, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-surface-300/50 border border-surface-400/30 animate-pulse"
              style={{
                width: n.size,
                height: n.size,
                top: n.top,
                left: n.left,
                transform: 'translate(-50%,-50%)',
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
          {/* Fake edges */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <line x1="25%" y1="18%" x2="50%" y2="30%" stroke="#71717a" strokeWidth="1" />
            <line x1="50%" y1="30%" x2="68%" y2="55%" stroke="#71717a" strokeWidth="1" />
            <line x1="15%" y1="42%" x2="35%" y2="65%" stroke="#71717a" strokeWidth="1" />
            <line x1="72%" y1="20%" x2="82%" y2="38%" stroke="#71717a" strokeWidth="1" />
            <line x1="25%" y1="18%" x2="15%" y2="42%" stroke="#71717a" strokeWidth="1" />
          </svg>
        </div>
      </main>
    </div>
  )
}
