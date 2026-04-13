import { create } from 'zustand'

interface BookmarkState {
  /** Set of bookmarked topic IDs */
  ids: Set<string>
  /** Whether the store has been loaded from the server */
  loaded: boolean
  loading: boolean

  /** Seed the store from the server (called once on first use) */
  load: () => Promise<void>

  /** Optimistically toggle a bookmark and sync with the server */
  toggle: (topicId: string) => Promise<void>

  /** Check if a topic is bookmarked */
  isBookmarked: (topicId: string) => boolean
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  loading: false,

  load: async () => {
    const { loaded, loading } = get()
    if (loaded || loading) return

    set({ loading: true })

    try {
      const res = await fetch('/api/bookmarks')
      if (!res.ok) return

      const data = (await res.json()) as { topicIds: string[] }
      set({ ids: new Set(data.topicIds), loaded: true })
    } catch {
      // Silent — store stays empty; user can still interact
    } finally {
      set({ loading: false })
    }
  },

  toggle: async (topicId: string) => {
    const { ids } = get()
    const wasBookmarked = ids.has(topicId)

    // Optimistic update
    const next = new Set(ids)
    if (wasBookmarked) {
      next.delete(topicId)
    } else {
      next.add(topicId)
    }
    set({ ids: next })

    try {
      const res = await fetch(`/api/topics/${topicId}/bookmark`, {
        method: 'POST',
      })

      if (!res.ok) {
        // Revert on failure
        const reverted = new Set(get().ids)
        if (wasBookmarked) {
          reverted.add(topicId)
        } else {
          reverted.delete(topicId)
        }
        set({ ids: reverted })
      }
    } catch {
      // Revert on network error
      const reverted = new Set(get().ids)
      if (wasBookmarked) {
        reverted.add(topicId)
      } else {
        reverted.delete(topicId)
      }
      set({ ids: reverted })
    }
  },

  isBookmarked: (topicId: string) => {
    return get().ids.has(topicId)
  },
}))
