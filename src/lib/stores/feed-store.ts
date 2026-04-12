import { create } from "zustand";
import type { Topic } from "@/lib/supabase/types";

export type FeedSort = "top" | "new" | "hot";
export type FeedStatus = "proposed" | "active" | "voting" | "law" | null;

interface FeedState {
  topics: Topic[];
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  sort: FeedSort;
  statusFilter: FeedStatus;
  _generation: number;

  fetchNextPage: () => Promise<void>;
  setSort: (sort: FeedSort) => void;
  setStatusFilter: (status: FeedStatus) => void;
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
  _generation: 0,

  fetchNextPage: async () => {
    const { isLoading, hasMore, offset, sort, statusFilter, _generation } =
      get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true });
    const capturedGen = _generation;

    try {
      const params = new URLSearchParams({ limit: "20", offset: String(offset), sort });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/feed?${params.toString()}`);

      // Discard stale responses when filters changed mid-flight
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
    } finally {
      if (get()._generation === capturedGen) {
        set({ isLoading: false });
      }
    }
  },

  setSort: (sort) => {
    const gen = get()._generation + 1;
    set({ sort, topics: [], offset: 0, hasMore: true, isLoading: false, _generation: gen });
    get().fetchNextPage();
  },

  setStatusFilter: (statusFilter) => {
    const gen = get()._generation + 1;
    set({ statusFilter, topics: [], offset: 0, hasMore: true, isLoading: false, _generation: gen });
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
