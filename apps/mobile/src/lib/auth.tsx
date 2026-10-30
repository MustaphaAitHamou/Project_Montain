import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppRole } from '@tamurt/shared';
import { supabase } from './supabase';

interface AuthValue {
  session: Session | null;
  userId: string | null;
  email: string | null;
  roles: AppRole[];
  loading: boolean;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  userId: null,
  email: null,
  roles: [],
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!supabase || !userId) return;
    let cancelled = false;
    void supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!cancelled) setRoles((data ?? []).map((r) => r.role as AppRole));
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      roles: session ? roles : [],
      loading,
    }),
    [session, roles, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
