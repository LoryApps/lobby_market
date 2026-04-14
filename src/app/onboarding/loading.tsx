import { Skeleton } from '@/components/ui/Skeleton'

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4">
      {/* Logo / brand mark */}
      <div className="mb-8 text-center space-y-2">
        <Skeleton className="h-12 w-12 rounded-2xl mx-auto" />
        <Skeleton className="h-6 w-40 mx-auto" />
        <Skeleton className="h-4 w-56 mx-auto" />
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className={`rounded-full ${i === 0 ? 'h-2.5 w-8' : 'h-2.5 w-2.5'}`} />
        ))}
      </div>

      {/* Question card */}
      <div className="w-full max-w-lg rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-6">
        {/* Prompt */}
        <div className="text-center space-y-2">
          <Skeleton className="h-5 w-3/4 mx-auto" />
          <Skeleton className="h-5 w-1/2 mx-auto" />
        </div>

        {/* Binary choice */}
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-surface-300 bg-surface-200 p-5 space-y-2"
            >
              <Skeleton className="h-5 w-20 mx-auto" />
              <Skeleton className="h-3 w-32 mx-auto" />
            </div>
          ))}
        </div>

        {/* Skip hint */}
        <Skeleton className="h-3 w-24 mx-auto" />
      </div>
    </div>
  )
}
