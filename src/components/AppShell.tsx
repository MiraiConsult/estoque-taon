'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session && pathname !== '/login' && pathname !== '/teste') {
      window.location.href = '/login';
    }
  }, [session, loading, pathname]);

  if (pathname === '/login' || pathname === '/teste') return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
      </div>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login' || pathname === '/teste') {
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
