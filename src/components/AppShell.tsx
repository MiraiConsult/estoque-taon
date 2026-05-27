'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading && !session && pathname !== '/login') {
      router.replace('/login');
    }
  }, [session, loading, pathname, router]);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setTimedOut(true), 4000);
      return () => clearTimeout(t);
    }
    setTimedOut(false);
  }, [loading]);

  // Never block the login page
  if (pathname === '/login') return <>{children}</>;

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
      </div>
    );
  }

  // If timed out or no session, redirect to login
  if (timedOut || !session) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  return <>{children}</>;
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="sidebar-main min-h-screen">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <LayoutContent>{children}</LayoutContent>
      </AuthGuard>
    </AuthProvider>
  );
}
