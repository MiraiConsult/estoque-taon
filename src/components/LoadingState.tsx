'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  loading: boolean;
  error?: string | null;
}

export default function LoadingState({ children, loading, error }: Props) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (error || (timedOut && loading)) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle size={40} className="text-red-300" />
        <p className="text-gray-700 font-medium">Erro ao carregar dados</p>
        {error && (
          <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-xs font-mono break-all">{error}</p>
          </div>
        )}
        {!error && timedOut && (
          <p className="text-gray-400 text-sm">Tempo limite excedido. Verifique sua conexão.</p>
        )}
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

  if (!loading) return <>{children}</>;

  return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
    </div>
  );
}
