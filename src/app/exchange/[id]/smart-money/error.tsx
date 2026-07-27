'use client'
export default function SmartMoneyError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <p className="text-surface-500 font-mono text-sm">Failed to load smart money data: {error.message}</p>
    </div>
  )
}
