import { create } from "zustand";
import type { Topic } from "@/lib/supabase/types";

interface FeedState {
  topics: Topic[];
  isLoading: boolean;
  hasMore: boolean;
  cursor: string | null;
  fetchNextPage: () => Promise<void>;
  prependTopic: (topic: Topic) => void;
  updateTopic: (id: string, updates: Partial<Topic>) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  topics: [],
  isLoading: false,
  hasMore: true,
  cursor: null,

  fetchNextPage: async () => {
    const { isLoading, hasMore, cursor } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true });

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/feed?${params.toString()}`);

      if (!res.ok) {
        console.error("Failed to fetch feed:", res.statusText);
        return;
      }

      const data: Topic[] = await res.json();

      if (data.length === 0) {
        set({ hasMore: false });
        return;
      }

      const lastTopic = data[data.length - 1];
      set((state) => ({
        topics: [...state.topics, ...data],
        cursor: String(lastTopic.feed_score),
        hasMore: data.length === 20,
      }));
    } finally {
      set({ isLoading: false });
    }
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
