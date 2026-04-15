import { create } from "zustand";
import type { Topic, TopicWithAuthor } from "@/lib/supabase/types";

export type FeedSort = "top" | "new" | "hot";
export type FeedStatus = "proposed" | "active" | "voting" | "law" | null;
export type FeedCategory = string | null;
export type FeedScope = "Global" | "National" | "Regional" | "Local" | null;
export type FeedMode = "discover" | "following" | "foryou";

interface FeedState {
  topics: TopicWithAuthor[];
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  sort: FeedSort;
  statusFilter: FeedStatus;
  categoryFilter: FeedCategory;
  scopeFilter: FeedScope;
  feedMode: FeedMode;
  /** How many users the current user follows (set from the API response) */
  followingCount: number;
  /** Categories from onboarding quiz (set when foryou mode is active) */
  preferredCategories: string[];
  /** Whether the user has completed the onboarding calibration quiz */
  hasPreferences: boolean;
  _generation: number;

  fetchNextPage: () => Promise<void>;
  setSort: (sort: FeedSort) => void;
  setStatusFilter: (status: FeedStatus) => void;
  setCategoryFilter: (category: FeedCategory) => void;
  setScopeFilter: (scope: FeedScope) => void;
  setFeedMode: (mode: FeedMode) => void;
  /** Realtime-injected topics don't have author data — treated as TopicWithAuthor with null author */
  prependTopic: (topic: Topic | TopicWithAuthor) => void;
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
  scopeFilter: null,
  feedMode: "discover",
  followingCount: 0,
  preferredCategories: [],
  hasPreferences: true,
  _generation: 0,

  fetchNextPage: async () => {
    const {
      isLoading,
      hasMore,
      offset,
      sort,
      statusFilter,
      categoryFilter,
      scopeFilter,
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

        const json: { topics: TopicWithAuthor[]; followingCount: number } =
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
      } else if (feedMode === "foryou") {
        // Personalized feed — topics filtered to the user's preferred categories
        const params = new URLSearchParams({
          limit: "20",
          offset: String(offset),
          sort,
        });

        const res = await fetch(`/api/feed/foryou?${params.toString()}`);

        if (get()._generation !== capturedGen) return;

        if (res.status === 401) {
          // Not logged in — fall back gracefully
          set({ hasMore: false, hasPreferences: false });
          return;
        }

        if (!res.ok) {
          console.error("Failed to fetch for-you feed:", res.statusText);
          return;
        }

        const json: {
          topics: TopicWithAuthor[];
          preferredCategories: string[];
          hasPreferences: boolean;
        } = await res.json();

        if (get()._generation !== capturedGen) return;

        set({
          preferredCategories: json.preferredCategories,
          hasPreferences: json.hasPreferences,
        });

        if (!json.hasPreferences || json.topics.length === 0) {
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
        if (scopeFilter) params.set("scope", scopeFilter);

        const res = await fetch(`/api/feed?${params.toString()}`);

        if (get()._generation !== capturedGen) return;

        if (!res.ok) {
          console.error("Failed to fetch feed:", res.statusText);
          return;
        }

        const data: TopicWithAuthor[] = await res.json();

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

  setScopeFilter: (scopeFilter) => {
    const gen = get()._generation + 1;
    set({
      scopeFilter,
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
    // Reset sort to "new" for following, "top" for everything else
    const sort = feedMode === "following" ? "new" : "top";
    set({
      feedMode,
      sort,
      scopeFilter: null,
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
      // Realtime topics don't have author data — add null author for type safety
      topics: [{ author: null, ...topic } as TopicWithAuthor, ...state.topics],
    })),

  updateTopic: (id, updates) =>
    set((state) => ({
      topics: state.topics.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
}));
