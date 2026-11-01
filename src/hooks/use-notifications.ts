"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  qNotifications,
  qUnreadCount,
  markNotificationRead as markReadAction,
  type NotificationDto,
} from "@/app/data/queries";

export type NotificationRow = NotificationDto;

/** Polls every 30 seconds while the tab is open (replaces the old realtime channel). */
const POLL_MS = 30_000;

export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: ["notifications", userId ?? ""],
    queryFn: () => qNotifications(),
    enabled: !!userId,
    refetchInterval: POLL_MS,
  });
}

export function useUnreadCount(userId: string | null) {
  return useQuery({
    queryKey: ["notifications-unread-count", userId ?? ""],
    queryFn: () => qUnreadCount(),
    enabled: !!userId,
    refetchInterval: POLL_MS,
  });
}

export async function markNotificationRead(id: string) {
  await markReadAction(id);
}

export function invalidateNotifications(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", userId] });
}
