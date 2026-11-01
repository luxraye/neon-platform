"use client";

import { useQuery } from "@tanstack/react-query";
import { qMe, type MeProfile, type MeInstitution, type MeResult } from "@/app/data/queries";

export type Profile = MeProfile;
export type UseProfileResult = MeResult;
export type { MeInstitution };

/**
 * The signed-in user's profile and centre, resolved on the server from the session cookie.
 * There is no browser auth state to race against, which fixes the old "Couldn't load your
 * profile" error that appeared when the browser session lagged behind the server.
 */
export function useProfile() {
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => qMe(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
