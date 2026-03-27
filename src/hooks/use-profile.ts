'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/utils/supabase/client';

export type Profile = {
  id: string;
  institution_id: string | null;
  email: string;
  role: 'admin' | 'headmaster' | 'tutor' | 'student';
  full_name: string | null;
  cohort_id: string | null;
  avatar_url: string | null;
};

type Institution = {
  id: string;
  name: string;
  subdomain: string;
  subscription_tier: 'starter' | 'growth' | 'elite';
  branding_config: unknown;
  student_limit: number;
  is_trial: boolean;
  trial_ends_at: string | null;
};

export type UseProfileResult = {
  user: User | null;
  profile: Profile | null;
  institution: Institution | null;
};

const supabase = createBrowserSupabaseClient();

export function useProfile() {
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (typeof window !== 'undefined') {
        console.log('[neon auth-user]', {
          ok: !error,
          userId: data?.user?.id ?? null,
          sessionLost: !error && !data?.user,
        });
      }
      if (error) throw error;
      return data.user ?? null;
    },
    retry: 3,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const profileQuery = useQuery({
    queryKey: ['profile', authQuery.data?.id ?? ''],
    queryFn: async ({ queryKey }): Promise<UseProfileResult> => {
      const [, uid] = queryKey;
      if (!uid || typeof uid !== 'string') {
        return { user: null, profile: null, institution: null };
      }

      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userResult.user;
      if (!user || user.id !== uid) {
        if (typeof window !== 'undefined') {
          console.warn('[neon profile] session mismatch vs query key', { uid, authId: user?.id });
        }
        return { user: null, profile: null, institution: null };
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, institution_id, email, role, full_name, cohort_id, avatar_url')
        .eq('id', user.id)
        .maybeSingle<Profile>();

      if (typeof window !== 'undefined') {
        console.log('[neon profile]', {
          userId: user.id,
          hasProfileRow: !!profile,
          profileError: profileError?.message ?? null,
        });
      }

      if (profileError) throw profileError;

      const roleFromMetadata = user?.user_metadata?.role as string | undefined;
      const rawRole = (profile?.role || roleFromMetadata || '').toString().trim().toLowerCase();
      const normalizedRole: Profile['role'] =
        rawRole === 'admin' ||
        rawRole === 'headmaster' ||
        rawRole === 'tutor' ||
        rawRole === 'student'
          ? (rawRole as Profile['role'])
          : 'student';
      const profileWithRole: Profile | null = profile
        ? { ...profile, role: normalizedRole }
        : profile;

      if (!profileWithRole || !profileWithRole.institution_id) {
        return { user, profile: profileWithRole, institution: null };
      }

      const { data: institution, error: institutionError } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', profileWithRole.institution_id)
        .maybeSingle<Institution>();

      if (institutionError) throw institutionError;

      return { user, profile: profileWithRole, institution };
    },
    enabled: authQuery.isSuccess && !!authQuery.data?.id,
    retry: 3,
    staleTime: 0,
  });

  const data = useMemo((): UseProfileResult | undefined => {
    if (!authQuery.isSuccess) return undefined;
    if (!authQuery.data) return { user: null, profile: null, institution: null };
    if (profileQuery.isLoading || profileQuery.isPending) return undefined;
    if (profileQuery.isError) return undefined;
    if (!profileQuery.isSuccess) return undefined;
    return profileQuery.data;
  }, [
    authQuery.isSuccess,
    authQuery.data,
    profileQuery.isLoading,
    profileQuery.isPending,
    profileQuery.isError,
    profileQuery.isSuccess,
    profileQuery.data,
  ]);

  const isLoading =
    authQuery.isLoading ||
    (authQuery.isSuccess && !!authQuery.data?.id && (profileQuery.isLoading || profileQuery.isPending));

  const isError = authQuery.isError || profileQuery.isError;
  const error = authQuery.error ?? profileQuery.error;

  const refetch = useCallback(async () => {
    await authQuery.refetch();
    await profileQuery.refetch();
  }, [authQuery, profileQuery]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ['auth-user'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
