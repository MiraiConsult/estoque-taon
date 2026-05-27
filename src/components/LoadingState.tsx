'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function LoadingState({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (!loading) return <>{children}</>;

  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle size={40} className="text-gray-300" />
        <p className="text-gray-500 font-medium">Erro ao carregar dados</p>
        <p className="text-gray-400 text-sm">Verifique sua conexão e tente novamente</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800"
        >
          <RefreshCw size={16} />
          Recarregar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
    </div>
  );
}
