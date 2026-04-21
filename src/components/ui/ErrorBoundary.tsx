'use client'

import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback component. Receives error + reset fn. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Called when an error is caught — good for logging. */
  onError?: (error: Error, info: ErrorInfo) => void
  /** Visual size of the default fallback. Default: 'md'. */
  size?: 'xs' | 'sm' | 'md'
  /** Label shown in the default fallback. Default: 'Something went wrong'. */
  label?: string
  /** Additional className on the default fallback wrapper. */
  className?: string
}

// ─── Default inline fallback ──────────────────────────────────────────────────

function DefaultFallback({
  error,
  reset,
  size = 'md',
  label = 'Something went wrong',
  className,
}: {
  error: Error
  reset: () => void
  size?: 'xs' | 'sm' | 'md'
  label?: string
  className?: string
}) {
  const isXs = size === 'xs'
  const isSm = size === 'sm'

  if (isXs) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-against-500/10 border border-against-500/20 text-against-400',
          className
        )}
        role="alert"
      >
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-mono flex-1 min-w-0 truncate">{label}</span>
        <button
          onClick={reset}
          aria-label="Retry"
          className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-surface-300/60 text-surface-400 hover:text-white hover:bg-surface-400 transition-colors"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center px-4',
        isSm ? 'py-10' : 'py-16',
        className
      )}
      role="alert"
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-against-500/10 border border-against-500/20',
          isSm ? 'h-10 w-10' : 'h-12 w-12'
        )}
      >
        <AlertTriangle
          className={cn(isSm ? 'h-5 w-5' : 'h-6 w-6', 'text-against-400')}
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <p className={cn('font-mono font-semibold text-white', isSm ? 'text-sm' : 'text-base')}>
          {label}
        </p>
        {error.message && (
          <p className="text-xs text-surface-500 font-mono max-w-xs leading-relaxed">
            {error.message.slice(0, 120)}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className={cn(
          'inline-flex items-center gap-1.5 font-mono font-medium transition-colors rounded-lg',
          'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300',
          isSm ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        )}
      >
        <RefreshCw className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden="true" />
        Try Again
      </button>
    </div>
  )
}

// ─── ErrorBoundary class ──────────────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
    this.reset = this.reset.bind(this)
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  reset() {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }
      return (
        <DefaultFallback
          error={this.state.error}
          reset={this.reset}
          size={this.props.size}
          label={this.props.label}
          className={this.props.className}
        />
      )
    }
    return this.props.children
  }
}

// ─── HOC helper ──────────────────────────────────────────────────────────────

/**
 * Wraps a component in an ErrorBoundary. Use when you want inline fallback
 * rather than a route-level error page.
 *
 * Usage:
 *   const SafeChart = withErrorBoundary(Chart, { size: 'sm', label: 'Chart failed' })
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  boundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): ComponentType<P> {
  const displayName = WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'

  function WithBoundary(props: P) {
    return (
      <ErrorBoundary {...boundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }

  WithBoundary.displayName = `withErrorBoundary(${displayName})`
  return WithBoundary
}
