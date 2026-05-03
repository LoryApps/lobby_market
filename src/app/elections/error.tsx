'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ElectionsError() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <p className="text-surface-500 text-sm">Failed to load elections.</p>
        <Link href="/" className="text-for-400 hover:underline text-sm">Go home</Link>
      </main>
      <BottomNav />
    </div>
  )
}
