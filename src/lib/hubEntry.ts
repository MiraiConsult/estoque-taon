import { supabase } from './supabase';

/**
 * Entrada pelo MC Castro Hub.
 *
 * O Hub abre este sistema com a sessão dele no fragmento da URL
 * (`#access_token=...&type=magiclink`). Aquele token é de outro projeto
 * Supabase, então quem o valida é `/api/hub-entry`, no servidor, que devolve um
 * token de entrada deste projeto para a conta de mesmo e-mail.
 *
 * Roda antes de qualquer decisão de sessão (ver `AuthContext`), senão o
 * AuthGuard manda para /login no meio da troca.
 */
export type FalhaEntradaHub =
  | 'sessao-invalida'
  | 'nao-e-admin'
  | 'sem-conta'
  | 'sem-service-role'
  | 'falha-ao-emitir'
  | 'erro';

export async function consumirEntradaPeloHub(): Promise<FalhaEntradaHub | null> {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash.includes('access_token=')) return null;

  const token = new URLSearchParams(hash.slice(1)).get('access_token');

  // Tira o fragmento da barra de endereço antes de qualquer ida à rede: o token
  // do Hub não tem por que continuar visível, nem sobreviver a um F5.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  if (!token) return 'erro';

  try {
    const resposta = await fetch('/api/hub-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { motivo?: string };
      return (corpo.motivo as FalhaEntradaHub) ?? 'erro';
    }

    const { token_hash: tokenHash } = (await resposta.json()) as { token_hash?: string };
    if (!tokenHash) return 'erro';

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });
    return error ? 'erro' : null;
  } catch {
    return 'erro';
  }
}

/** Recado de por que a entrada automática não valeu, para a tela de login. */
export function recadoDaFalha(motivo: string): string | null {
  switch (motivo) {
    case 'sem-conta':
      return 'Seu e-mail do Hub ainda não tem conta neste sistema. Entre com a senha daqui, ou peça a um admin para criar o acesso.';
    case 'nao-e-admin':
      return 'A entrada direta pelo Hub vale só para administradores. Entre com a senha deste sistema.';
    case 'sessao-invalida':
      return 'A sessão do Hub expirou no caminho. Entre com a senha daqui, ou volte ao Hub e tente de novo.';
    case 'sem-service-role':
    case 'falha-ao-emitir':
    case 'erro':
      return 'Não deu para entrar direto pelo Hub desta vez. Entre com a senha deste sistema.';
    default:
      return null;
  }
}
