'use client'

import nextDynamic from 'next/dynamic'

const HeartViewer = nextDynamic(
  () => import('./HeartViewer').then((m) => m.HeartViewer),
  {
    ssr: false,
    loading: () => <HeartLoader />,
  }
)

export function HeartViewerClient() {
  return <HeartViewer />
}

export function HeartLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#07070b]">
      <div className="text-center">
        <div className="mb-4 inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-full border border-white/20 bg-white/5">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
        <div className="text-sm tracking-widest text-white/60">
          SOLVING THE SURFACE...
        </div>
      </div>
    </div>
  )
}
