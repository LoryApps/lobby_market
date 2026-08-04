import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Topic, TopicWithAuthor } from "@/lib/supabase/types";

export type FeedSort = "top" | "new" | "hot";
export type FeedStatus = "proposed" | "active" | "voting" | "law" | null;
export type FeedCategory = string | null;
export type FeedScope = "Global" | "National" | "Regional" | "Local" | null;
export type FeedTag = string | null;
export type FeedMode = "discover" | "following" | "foryou" | "mytags" | "unvoted" | "battleground" | "rising" | "closingin";

interface FeedState {
  topics: TopicWithAuthor[];
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  sort: FeedSort;
  statusFilter: FeedStatus;
  categoryFilter: FeedCategory;
  scopeFilter: FeedScope;
  tagFilter: FeedTag;
  feedMode: FeedMode;
  /** How many users the current user follows (set from the API response) */
  followingCount: number;
  /** Categories from onboarding quiz or inferred from vote history */
  preferredCategories: string[];
  /** Whether there are any usable category preferences */
  hasPreferences: boolean;
  /** Source: quiz preferences, inferred from vote history, or none */
  preferenceSource: 'quiz' | 'history' | 'none';
  /** Number of votes analyzed when inferring from history */
  inferredFromVotes: number;
  _generation: number;

  fetchNextPage: () => Promise<void>;
  setSort: (sort: FeedSort) => void;
  setStatusFilter: (status: FeedStatus) => void;
  setCategoryFilter: (category: FeedCategory) => void;
  setScopeFilter: (scope: FeedScope) => void;
  setTagFilter: (tag: FeedTag) => void;
  setFeedMode: (mode: FeedMode) => void;
  clearFilters: () => void;
  /** Reset topics and re-fetch from scratch (preserves current mode + filters) */
  refresh: () => void;
  /** Realtime-injected topics don't have router data — treated as TopicWithAuthor with null author */
  prependTopic: (topic: Topic | TopicWithAuthor) => void;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      topics: [],
      isLoading: false,
      hasMore: true,
      offset: 0,
      sort: "top",
      statusFilter: null,
      categoryFilter: null,
      scopeFilter: null,
      tagFilter: null,
      feedMode: "discover",
      followingCount: 0,
      preferredCategories: [],
      hasPreferences: true,
      preferenceSource: 'quiz',
      inferredFromVotes: 0,
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
          tagFilter,
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
              preferenceSource: 'quiz' | 'history' | 'none';
              inferredFromVotes: number;
            } = await res.json();

            if (get()._generation !== capturedGen) return;

            set({
              preferredCategories: json.preferredCategories,
              hasPreferences: json.hasPreferences,
              preferenceSource: json.preferenceSource ?? 'quiz',
              inferredFromVotes: json.inferredFromVotes ?? 0,
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
          } else if (feedMode === "mytags") {
            // My Tags feed — topics matching the user's followed tags
            const params = new URLSearchParams({
              limit: "20",
              offset: String(offset),
              sort,
            });

            const res = await fetch(`/api/feed/tags?${params.toString()}`);

            if (get()._generation !== capturedGen) return;

            if (res.status === 401) {
              set({ hasMore: false });
              return;
            }

            if (!res.ok) {
              console.error("Failed to fetch my-tags feed:", res.statusText);
              return;
            }

            const json: {
              topics: TopicWithAuthor[];
              followedTags: string[];
              followedTagCount: number;
            } = await res.json();

            if (get()._generation !== capturedGen) return;

            if (json.followedTagCount === 0 || json.topics.length === 0) {
              set({ hasMore: false });
              return;
            }

            set((state) => ({
              topics: [...state.topics, ...json.topics],
              offset: state.offset + json.topics.length,
              hasMore: json.topics.length === 20,
            }));
          } else if (feedMode === "unvoted") {
            // Unvoted feed — topics in preferred categories not yet voted on
            const params = new URLSearchParams({
              limit: "20",
              offset: String(offset),
              sort,
            });

            const res = await fetch(`/api/feed/unvoted?${params.toString()}`);

            if (get()._generation !== capturedGen) return;

            if (res.status === 401) {
              set({ hasMore: false });
              return;
            }

            if (!res.ok) {
              console.error("Failed to fetch unvoted feed:", res.statusText);
              return;
            }

            const json: {
              topics: TopicWithAuthor[];
              preferredCategories: string[];
              preferenceSource: 'quiz' | 'history' | 'none';
              votedCount: number;
              remainingUnvoted: number;
            } = await res.json();

            if (get()._generation !== capturedGen) return;

            set({
              preferredCategories: json.preferredCategories,
              hasPreferences: json.preferredCategories.length > 0,
              preferenceSource: json.preferenceSource,
            });

            if (json.topics.length === 0) {
              set({ hasMore: false });
              return;
            }

            set((state) => ({
              topics: [...state.topics, ...json.topics],
              offset: state.offset + json.topics.length,
              hasMore: json.topics.length === 20,
            }));
          } else if (feedMode === "battleground") {
            // Battleground feed — contested 50/50 topics ordered by contest score
            const params = new URLSearchParams({
              limit: "20",
              offset: String(offset),
              sort,
            });

            const res = await fetch(`/api/feed/battleground?${params.toString()}`);

            if (get()._generation !== capturedGen) return;

            if (!res.ok) {
              console.error("Failed to fetch battleground feed:", res.statusText);
              return;
            }

            const json: { topics: TopicWithAuthor[] } = await res.json();

            if (get()._generation !== capturedGen) return;

            if (json.topics.length === 0) {
              set({ hasMore: false });
              return;
            }

            set((state) => ({
              topics: [...state.topics, ...json.topics],
              offset: state.offset + json.topics.length,
              hasMore: json.topics.length === 20,
            }));
          } else if (feedMode === "rising") {
            // Rising feed — topics gaining votes rapidly (high velocity)
            const params = new URLSearchParams({
              limit: "20",
              offset: String(offset),
              sort,
            });

            const res = await fetch(`/api/feed/rising?${params.toString()}`);

            if (get()._generation !== capturedGen) return;

            if (!res.ok) {
              console.error("Failed to fetch rising feed:", res.statusText);
              return;
            }

            const json: { topics: TopicWithAuthor[] } = await res.json();

            if (get()._generation !== capturedGen) return;

            if (json.topics.length === 0) {
              set({ hasMore: false });
              return;
            }

            set((state) => ({
              topics: [...state.topics, ...json.topics],
              offset: state.offset + json.topics.length,
              hasMore: json.topics.length === 20,
            }));
          } else if (feedMode === "closingin") {
            // Near Law feed — voting-phase topics sorted by proximity to law threshold
            const params = new URLSearchParams({
              limit: "20",
              offset: String(offset),
              sort,
            });

            const res = await fetch(`/api/feed/closingin?${params.toString()}`);

            if (get()._generation !== capturedGen) return;

            if (!res.ok) {
              console.error("Failed to fetch near-law feed:", res.statusText);
              return;
            }

            const json: { topics: TopicWithAuthor[] } = await res.json();

            if (get()._generation !== capturedGen) return;

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
            if (scopeFilter) params.set("scope", scopeFilter);
            if (tagFilter) params.set("tag", tagFilter);

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

      setTagFilter: (tagFilter) => {
        const gen = get()._generation + 1;
        set({
          tagFilter,
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
        // Reset sort to "new" for following/mytags, "top" for everything else
        const sort = (feedMode === "following" || feedMode === "mytags") ? "new"
          : (feedMode === "unvoted" || feedMode === "battleground") ? "hot"
          : (feedMode === "rising" || feedMode === "closingin") ? "top"
          : "top";
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

      clearFilters: () => {
        const gen = get()._generation + 1;
        set({
          statusFilter: null,
          categoryFilter: null,
          scopeFilter: null,
          tagFilter: null,
          sort: "top",
          topics: [],
          offset: 0,
          hasMore: true,
          isLoading: false,
          _generation: gen,
        });
        get().fetchNextPage();
      },

      refresh: () => {
        const gen = get()._generation + 1;
        set({ topics: [], offset: 0, hasMore: true, isLoading: false, _generation: gen });
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
    }),
    {
      name: "lm-feed-prefs",
      // Only persist user preference fields — never volatile state like topics/loading/offset
      partialize: (state) => ({
        sort: state.sort,
        feedMode: state.feedMode,
        statusFilter: state.statusFilter,
        categoryFilter: state.categoryFilter,
        scopeFilter: state.scopeFilter,
        tagFilter: state.tagFilter,
      }),
    }
  )
);
