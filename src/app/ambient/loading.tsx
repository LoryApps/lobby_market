import { Skeleton } from '@/components/ui/Skeleton'

export default function AmbientLoading() {
  return (
    <div className="h-screen w-screen bg-surface-950 flex flex-col items-center justify-center gap-6">
      <Skeleton className="h-16 w-64 rounded-2xl bg-surface-800/60" />
      <Skeleton className="h-4 w-40 rounded bg-surface-800/40" />
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="absolute rounded-full bg-surface-800/30"
            style={{
              width: `${80 + i * 60}px`,
              height: `${40 + i * 30}px`,
              top: `${10 + i * 14}%`,
              left: `${5 + (i % 3) * 30}%`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
