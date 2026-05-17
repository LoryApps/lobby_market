'use client'

export default function Error() {
  return (
    <div className="h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-center">
        <p className="font-mono text-white font-semibold mb-2">Something went wrong</p>
        <a href="/reel" className="font-mono text-sm text-for-400 hover:text-for-300">
          Reload the reel
        </a>
      </div>
    </div>
  )
}
