'use client';

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { consumirEntradaPeloHub } from '@/lib/hubEntry';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: false,
  isAdmin: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Entrada pelo MC Castro Hub: se a URL trouxe a sessão do Hub, ela é trocada
    // por uma sessão daqui ANTES de olhar o armazenamento — senão o AuthGuard
    // veria "sem sessão" no meio da troca e mandaria para /login.
    const boot = async () => {
      const falha = await consumirEntradaPeloHub();
      if (falha) {
        try {
          sessionStorage.setItem('hub_entrada_falhou', falha);
        } catch {}
      }

      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (!data.session?.user) return;

      const { data: p } = await supabase
        .from('profiles')
        .select('id, email, name, role')
        .eq('id', data.session.user.id)
        .single();
      if (p) setProfile(p as Profile);
    };

    boot()
      .catch(() => {})
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (!s) setProfile(null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      isAdmin: profile?.role === 'admin',
      signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
