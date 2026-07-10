export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-surface-300" />
        <div className="mb-4 flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-surface-300" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-200 p-5">
              <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-surface-300" />
              <div className="mb-4 h-4 w-1/2 animate-pulse rounded bg-surface-300" />
              <div className="h-10 w-40 animate-pulse rounded-lg bg-surface-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
