'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawAuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <>
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto px-4 pt-8 space-y-4 text-center">
          <AlertTriangle className="w-10 h-10 text-against-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">Audit unavailable</h1>
          <p className="text-sm text-surface-500">
            The democratic audit for this law could not be loaded.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
            <Link
              href="./"
              className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-surface-400 hover:bg-surface-300 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to law
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
