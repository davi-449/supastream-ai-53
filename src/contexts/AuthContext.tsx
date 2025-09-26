import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface AuthContextValue {
  user: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        // ignore
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      try { sub.subscription.unsubscribe(); } catch (e) {}
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (e) {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
