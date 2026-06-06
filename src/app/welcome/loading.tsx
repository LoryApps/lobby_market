import { Skeleton } from '@/components/ui/Skeleton'

export default function WelcomeLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Simple top bar skeleton */}
      <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center justify-between px-4 flex-shrink-0">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
        {/* Logo / icon */}
        <Skeleton className="h-20 w-20 rounded-3xl mb-6" />

        {/* Title */}
        <Skeleton className="h-9 w-64 mx-auto mb-3" />
        <Skeleton className="h-5 w-48 mx-auto mb-8" />

        {/* Hero description */}
        <div className="max-w-md w-full space-y-2 mb-10">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 mx-auto" />
          <Skeleton className="h-4 w-4/5 mx-auto" />
        </div>

        {/* Feature tiles */}
        <div className="grid grid-cols-3 gap-4 max-w-sm w-full mb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-2">
              <Skeleton className="h-8 w-8 rounded-xl mx-auto" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4 mx-auto" />
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </main>
    </div>
  )
}
