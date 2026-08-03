'use client'

import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      aria-label="Print this law report"
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
        'border border-surface-300 bg-surface-200 hover:bg-surface-300',
        'text-xs font-mono text-surface-400 hover:text-white transition-all'
      )}
    >
      <Printer className="h-3.5 w-3.5" />
      Print this report
    </button>
  )
}
