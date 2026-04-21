import { Scale } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function QuizLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-for-500/10 border border-for-500/30">
            <Scale className="h-10 w-10 text-for-400/60 animate-pulse" />
          </div>
        </div>
        <Skeleton className="h-8 w-40 mx-auto mb-4" />
        <Skeleton className="h-4 w-72 mx-auto mb-2" />
        <Skeleton className="h-4 w-60 mx-auto mb-8" />
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  )
}
