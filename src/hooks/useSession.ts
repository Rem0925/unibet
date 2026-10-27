'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { isSupabaseConfigured } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { MeResponse, UserProfile } from '@/lib/types';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
        setProfileLoading(false);
      } else {
        setSession(data.session);
        setProfileLoading(Boolean(data.session));
      }
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setError(null);

      if (nextSession) {
        setProfileLoading(true);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;

    let bodyPayload: Record<string, string> | undefined = undefined;
    if (typeof window !== 'undefined') {
      try {
        const pending = localStorage.getItem('unibet_pending_registration');
        if (pending) {
          bodyPayload = JSON.parse(pending);
        }
      } catch {}
    }

    void apiFetch<MeResponse>('/api/auth/sync', {
      method: 'POST',
      body: bodyPayload ? JSON.stringify(bodyPayload) : undefined,
    })
      .then((response) => {
        if (active) {
          setProfile(response.profile);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('unibet_pending_registration');
          }
        }
      })
      .catch((syncError: unknown) => {
        if (!active) return;
        setProfile(null);
        setError(errorMessage(syncError));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const refreshProfile = useCallback(async () => {
    const response = await apiFetch<MeResponse>('/api/me');
    setProfile(response.profile);
    return response.profile;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setProfileLoading(false);
    setError(null);
  }, []);

  return {
    session,
    profile,
    initializing,
    profileLoading,
    error,
    setError,
    refreshProfile,
    logout,
    configured: isSupabaseConfigured,
  };
}
