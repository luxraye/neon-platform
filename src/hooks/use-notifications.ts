"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "fee_reminder" | "quiz_result" | "announcement";
  is_read: boolean;
  created_at: string;
};

export function useNotifications(userId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["notifications", userId ?? ""],
    queryFn: async (): Promise<NotificationRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, title, message, type, is_read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    enabled: !!userId,
  });
}

export function useUnreadCount(userId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["notifications-unread-count", userId ?? ""],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
  });
}

export async function markNotificationRead(id: string) {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

export function invalidateNotifications(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", userId] });
}

