// Manages a localStorage-backed list of recently viewed topic IDs.
// Persists across sessions (unlike sessionStorage used for view-count dedup).

const STORAGE_KEY = 'lm_recently_viewed_v2'
const MAX_ITEMS = 30

export interface RecentlyViewedEntry {
  id: string
  viewed_at: string // ISO timestamp
  statement?: string
  status?: string
}

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentlyViewedEntry[]
  } catch {
    return []
  }
}

export function recordTopicView(
  topicId: string,
  meta?: { statement?: string; status?: string }
): void {
  if (typeof localStorage === 'undefined') return
  try {
    const existing = getRecentlyViewed().filter((e) => e.id !== topicId)
    const entry: RecentlyViewedEntry = {
      id: topicId,
      viewed_at: new Date().toISOString(),
      ...(meta?.statement ? { statement: meta.statement } : {}),
      ...(meta?.status ? { status: meta.status } : {}),
    }
    const updated: RecentlyViewedEntry[] = [entry, ...existing].slice(0, MAX_ITEMS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // localStorage unavailable (private mode, quota, etc.)
  }
}

export function clearRecentlyViewed(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
