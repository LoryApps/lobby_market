import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="font-mono text-xs text-surface-500 uppercase tracking-widest mb-3">
          Not Found
        </p>
        <h1 className="text-2xl font-bold text-white mb-2">No such citizen</h1>
        <p className="text-sm text-surface-500 mb-6">
          This Lobby Card doesn&rsquo;t exist or the citizen hasn&rsquo;t joined yet.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-for-600 hover:bg-for-500 px-5 py-2.5 text-sm font-mono font-semibold text-white transition-colors"
        >
          Enter the Lobby
        </Link>
      </div>
    </div>
  )
}
