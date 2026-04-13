import { create } from "zustand";
import type { Topic } from "@/lib/supabase/types";

export type FeedSort = "top" | "new" | "hot";
export type FeedStatus = "proposed" | "active" | "voting" | "law" | null;
export type FeedCategory = string | null;
export type FeedMode = "discover" | "following";

interface FeedState {
  topics: Topic[];
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  sort: FeedSort;
  statusFilter: FeedStatus;
  categoryFilter: FeedCategory;
  feedMode: FeedMode;
  /** How many users the current user follows (set from the API response) */
  followingCount: number;
  _generation: number;

  fetchNextPage: () => Promise<void>;
  setSort: (sort: FeedSort) => void;
  setStatusFilter: (status: FeedStatus) => void;
  setCategoryFilter: (category: FeedCategory) => void;
  setFeedMode: (mode: FeedMode) => void;
  prependTopic: (topic: Topic) => void;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  topics: [],
  isLoading: false,
  hasMore: true,
  offset: 0,
  sort: "top",
  statusFilter: null,
  categoryFilter: null,
  feedMode: "discover",
  followingCount: 0,
  _generation: 0,

  fetchNextPage: async () => {
    const {
      isLoading,
      hasMore,
      offset,
      sort,
      statusFilter,
      categoryFilter,
      feedMode,
      _generation,
    } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true });
    const capturedGen = _generation;

    try {
      if (feedMode === "following") {
        // Following feed — separate endpoint, no status/category filters
        const params = new URLSearchParams({
          limit: "20",
          offset: String(offset),
          sort,
        });

        const res = await fetch(`/api/feed/following?${params.toString()}`);

        if (get()._generation !== capturedGen) return;

        if (res.status === 401) {
          // Not logged in — stop trying
          set({ hasMore: false });
          return;
        }

        if (!res.ok) {
          console.error("Failed to fetch following feed:", res.statusText);
          return;
        }

        const json: { topics: Topic[]; followingCount: number } =
          await res.json();

        if (get()._generation !== capturedGen) return;

        set({ followingCount: json.followingCount });

        if (json.topics.length === 0) {
          set({ hasMore: false });
          return;
        }

        set((state) => ({
          topics: [...state.topics, ...json.topics],
          offset: state.offset + json.topics.length,
          hasMore: json.topics.length === 20,
        }));
      } else {
        // Discover feed
        const params = new URLSearchParams({
          limit: "20",
          offset: String(offset),
          sort,
        });
        if (statusFilter) params.set("status", statusFilter);
        if (categoryFilter) params.set("category", categoryFilter);

        const res = await fetch(`/api/feed?${params.toString()}`);

        if (get()._generation !== capturedGen) return;

        if (!res.ok) {
          console.error("Failed to fetch feed:", res.statusText);
          return;
        }

        const data: Topic[] = await res.json();

        if (get()._generation !== capturedGen) return;

        if (data.length === 0) {
          set({ hasMore: false });
          return;
        }

        set((state) => ({
          topics: [...state.topics, ...data],
          offset: state.offset + data.length,
          hasMore: data.length === 20,
        }));
      }
    } finally {
      if (get()._generation === capturedGen) {
        set({ isLoading: false });
      }
    }
  },

  setSort: (sort) => {
    const gen = get()._generation + 1;
    set({
      sort,
      topics: [],
      offset: 0,
      hasMore: true,
      isLoading: false,
      _generation: gen,
    });
    get().fetchNextPage();
  },

  setStatusFilter: (statusFilter) => {
    const gen = get()._generation + 1;
    set({
      statusFilter,
      topics: [],
      offset: 0,
      hasMore: true,
      isLoading: false,
      _generation: gen,
    });
    get().fetchNextPage();
  },

  setCategoryFilter: (categoryFilter) => {
    const gen = get()._generation + 1;
    set({
      categoryFilter,
      topics: [],
      offset: 0,
      hasMore: true,
      isLoading: false,
      _generation: gen,
    });
    get().fetchNextPage();
  },

  setFeedMode: (feedMode) => {
    const gen = get()._generation + 1;
    // Reset sort to "new" for following (most relevant) and back to "top" for discover
    const sort = feedMode === "following" ? "new" : "top";
    set({
      feedMode,
      sort,
      topics: [],
      offset: 0,
      hasMore: true,
      isLoading: false,
      _generation: gen,
    });
    get().fetchNextPage();
  },

  prependTopic: (topic) =>
    set((state) => ({
      topics: [topic, ...state.topics],
    })),

  updateTopic: (id, updates) =>
    set((state) => ({
      topics: state.topics.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
}));
