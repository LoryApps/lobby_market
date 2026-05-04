'use client'

import Link from 'next/link'

export default function MomentsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="fixed inset-0 bg-surface-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-surface-300 text-lg font-semibold">Couldn&apos;t load moments</p>
      <p className="text-surface-500 text-sm max-w-xs">
        Something went wrong fetching civic highlights. Try again or head back to the feed.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-emerald/10 text-emerald text-sm font-medium hover:bg-emerald/20 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-surface-800 text-surface-300 text-sm font-medium hover:bg-surface-700 transition-colors"
        >
          Back to feed
        </Link>
      </div>
    </div>
  )
}
