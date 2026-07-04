'use client'

/**
 * useHaptics / haptics
 *
 * Typed haptic feedback for mobile interactions.
 *
 * Uses the Vibration API (supported on Android Chrome/PWA; graceful no-op on
 * iOS Safari and desktop).  Patterns are tuned for civic interaction semantics:
 *   - voteFor    → double pulse (affirmative)
 *   - voteAgainst → single firm tap (oppositional)
 *   - success    → quick burst + hold (celebration)
 *   - milestone  → longer celebration sequence (achievement unlock)
 *   - error      → long firm buzz (failure / blocked)
 *   - dismiss    → subtle tick (close / swipe away)
 *   - light      → nearly imperceptible tap (hover / select)
 *
 * All calls are wrapped in try/catch — some browsers throw when the
 * Vibration API is blocked by a Permissions-Policy header.
 *
 * Two usage patterns:
 *   1. `import { haptics } from '@/lib/hooks/useHaptics'`
 *      — stable singleton, safe in useCallback/useEffect deps without listing.
 *
 *   2. `const h = useHaptics()` — same API as the singleton, provided for
 *      symmetry with other hook-based utilities.
 */

const PATTERNS = {
  vote_for:     [25, 15, 35],                   // double tap — affirm FOR
  vote_against: [55],                            // firm single — oppose AGAINST
  success:      [20, 10, 20, 10, 60],           // quick doubles + hold
  milestone:    [30, 15, 30, 15, 30, 15, 80],  // multi-tap celebration
  error:        [90],                            // long single — blocked / failed
  dismiss:      [18],                            // subtle tick — sheet dismissed
  light:        [12],                            // barely-there touch feedback
  selection:    [15],                            // gentle tap — item selected / option chosen
} as const

export type HapticPattern = keyof typeof PATTERNS

function vibrate(pattern: number | readonly number[]): void {
  if (typeof navigator === 'undefined') return
  if (!('vibrate' in navigator)) return
  try {
    navigator.vibrate(pattern as number | number[])
  } catch {
    // Silently ignore — may be blocked by Permissions-Policy or user gesture requirement
  }
}

/**
 * Stable singleton — always the same object reference, safe inside
 * useCallback / useEffect dependency arrays without listing.
 */
export const haptics = {
  trigger(pattern: HapticPattern = 'light') { vibrate(PATTERNS[pattern]) },
  voteFor()      { vibrate(PATTERNS.vote_for)      },
  voteAgainst()  { vibrate(PATTERNS.vote_against)  },
  success()      { vibrate(PATTERNS.success)       },
  milestone()    { vibrate(PATTERNS.milestone)     },
  error()        { vibrate(PATTERNS.error)         },
  dismiss()      { vibrate(PATTERNS.dismiss)       },
  light()        { vibrate(PATTERNS.light)         },
  selection()    { vibrate(PATTERNS.selection)     },
} as const

/** Hook alias — returns the same singleton. */
export function useHaptics() {
  return haptics
}
