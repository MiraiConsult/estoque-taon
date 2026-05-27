'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { AuthProvider } from '@/contexts/AuthContext';

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
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}
