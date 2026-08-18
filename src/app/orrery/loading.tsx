import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function OrreryLoading() {
  return (
    <div className="min-h-screen bg-[#050508]">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0 bg-gold/20" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-36 bg-surface-300/30" />
            <Skeleton className="h-4 w-72 bg-surface-300/20" />
          </div>
        </div>

        {/* Orrery canvas — concentric ring skeleton */}
        <div className="relative w-full aspect-square max-h-[500px] mx-auto flex items-center justify-center">
          {/* Sun / core */}
          <Skeleton className="absolute h-16 w-16 rounded-full bg-gold/25 z-10" />

          {/* Orbital rings (pure CSS borders) */}
          {[120, 200, 290, 380].map((size, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-surface-300/15 animate-pulse"
              style={{ width: size, height: size }}
            />
          ))}

          {/* Planet dots on orbits */}
          {[
            { orbit: 60, angle: 45 },
            { orbit: 60, angle: 200 },
            { orbit: 100, angle: 80 },
            { orbit: 100, angle: 160 },
            { orbit: 100, angle: 310 },
            { orbit: 145, angle: 20 },
            { orbit: 145, angle: 130 },
            { orbit: 145, angle: 250 },
            { orbit: 190, angle: 60 },
            { orbit: 190, angle: 180 },
            { orbit: 190, angle: 320 },
          ].map(({ orbit, angle }, i) => {
            const rad = (angle * Math.PI) / 180
            const x = orbit * Math.cos(rad)
            const y = orbit * Math.sin(rad)
            return (
              <Skeleton
                key={i}
                className="absolute rounded-full bg-surface-300/40"
                style={{
                  width: `${10 + (i % 3) * 6}px`,
                  height: `${10 + (i % 3) * 6}px`,
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              />
            )
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-lg bg-surface-300/25" />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
