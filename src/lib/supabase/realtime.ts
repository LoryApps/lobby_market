import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Topic } from "@/lib/supabase/types";

export function subscribeToTopic(
  topicId: string,
  onUpdate: (topic: Partial<Topic>) => void
): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel(`topic:${topicId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "topics",
        filter: `id=eq.${topicId}`,
      },
      (payload) => onUpdate(payload.new as Partial<Topic>)
    )
    .subscribe();
}

export function subscribeToFeed(
  onInsert: (topic: Topic) => void,
  onUpdate: (topic: Topic) => void
): RealtimeChannel {
  const supabase = createClient();
  return supabase
    .channel("feed")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "topics" },
      (payload) => onInsert(payload.new as Topic)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "topics" },
      (payload) => onUpdate(payload.new as Topic)
    )
    .subscribe();
}
