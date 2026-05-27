'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { LogIn, AlertCircle, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError('Email ou senha incorretos');
        setLoading(false);
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ marginLeft: 0 }}
    >
      <div className="absolute inset-0 bg-[#1a1a1a]" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(180,180,180,0.15) 0%, transparent 60%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 30%, rgba(29,111,165,0.08) 0%, transparent 50%)' }} />

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="h-px w-16 mx-auto bg-gradient-to-r from-transparent via-gray-600 to-transparent mb-3" />
          <p className="text-sm text-gray-500 tracking-wide">Controle de Estoque</p>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl shadow-black/20">
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-sm text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Sua senha"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-70 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #1d6fa5 0%, #1a4a70 100%)' }}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mx-auto" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={16} />
                  Entrar
                </span>
              )}
            </button>
          </form>
        </div>

        <div className="flex justify-center mt-6 gap-2">
          {['Isla', 'Playa', 'Aura'].map((casa) => (
            <span
              key={casa}
              className={`text-[10px] px-2.5 py-1 rounded-full ${
                casa === 'Isla'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : casa === 'Playa'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              }`}
            >
              {casa}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
