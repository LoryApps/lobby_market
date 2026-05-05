import { Skeleton } from '@/components/ui/Skeleton'

export default function CertificateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-10 bg-surface-100/80 backdrop-blur border-b border-surface-300 px-4 py-3">
        <div className="max-w-2xl mx-auto h-8" />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          <div className="px-8 pt-8 pb-4 text-center border-b border-surface-300">
            <Skeleton className="h-4 w-48 mx-auto mb-2" />
            <Skeleton className="h-3 w-64 mx-auto" />
          </div>
          <div className="px-8 py-8 flex flex-col items-center gap-5">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 w-full max-w-xs mx-auto">
              <Skeleton className="h-3 w-24 mx-auto" />
              <Skeleton className="h-8 w-48 mx-auto" />
              <Skeleton className="h-4 w-36 mx-auto" />
            </div>
          </div>
          <div className="mx-8 h-px bg-surface-300" />
          <div className="px-8 py-6 text-center space-y-3">
            <Skeleton className="h-3 w-20 mx-auto" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5 mx-auto" />
          </div>
          <div className="mx-8 mb-6 rounded-xl border border-surface-300 overflow-hidden">
            <Skeleton className="h-2 w-full" />
            <div className="px-5 py-3 grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-12 mx-auto" />
                  <Skeleton className="h-2 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="px-8 pb-6 text-center space-y-1">
            <Skeleton className="h-3 w-48 mx-auto" />
            <Skeleton className="h-4 w-56 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
