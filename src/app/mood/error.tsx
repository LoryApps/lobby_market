'use client'

export default function MoodError() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <p className="text-surface-500 font-mono text-sm">Failed to load civic mood data.</p>
    </div>
  )
}
