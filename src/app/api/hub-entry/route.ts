import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Entrada pelo MC Castro Hub, sem pedir senha de novo.
 *
 * O Hub repassa a sessão dele no fragmento da URL, mas o token é assinado pelo
 * projeto Supabase do Hub — aqui ele não vale nada. Esta rota é a ponte: recebe
 * o token do Hub, confere no projeto do Hub quem é e se aquela pessoa é admin
 * lá, e só então usa a service_role deste projeto para emitir um token de
 * entrada (o mesmo hashed_token de um magic link) para a conta de mesmo e-mail
 * daqui. O navegador troca esse token por sessão com `verifyOtp`.
 *
 * O que garante a segurança: a service_role nunca sai do servidor, e o e-mail
 * não vem do cliente — vem do token verificado no Hub. Sem conta com aquele
 * e-mail aqui, não há entrada: esta rota não cria usuário.
 *
 * O endereço e a chave publicável do Hub são públicos (vão no bundle do Hub);
 * ficam como padrão no código para não exigir variável de ambiente nova, mas
 * podem ser sobrescritos se o Hub rotacionar a chave.
 */
const HUB_URL = process.env.HUB_SUPABASE_URL ?? 'https://evrkowxyujyrtnzwadjf.supabase.co';
const HUB_KEY = process.env.HUB_SUPABASE_ANON_KEY ?? 'sb_publishable_3upO38t1f9qcckiZLksW8A';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function recusa(motivo: string, status: number) {
  return NextResponse.json({ motivo }, { status });
}

export async function POST(request: NextRequest) {
  let token: string | undefined;
  try {
    token = (await request.json())?.token;
  } catch {
    return recusa('sem-token', 400);
  }
  if (!token) return recusa('sem-token', 400);

  // 1. Quem é, segundo o projeto do Hub. Também é aqui que token expirado ou
  //    revogado morre — não basta a assinatura bater.
  const quem = await fetch(`${HUB_URL}/auth/v1/user`, {
    headers: { apikey: HUB_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!quem.ok) return recusa('sessao-invalida', 401);

  const usuarioHub = (await quem.json()) as { id?: string; email?: string };
  if (!usuarioHub.id || !usuarioHub.email) return recusa('sessao-invalida', 401);

  // 2. Só admin do Hub entra assim. A conta de cliente do Hub não corresponde a
  //    permissão nenhuma aqui dentro — mesma regra do repasse de sessão do Hub.
  //    A policy `members_select` deixa cada um ler a própria linha.
  const membro = await fetch(
    `${HUB_URL}/rest/v1/members?select=role&user_id=eq.${usuarioHub.id}`,
    {
      headers: {
        apikey: HUB_KEY,
        Authorization: `Bearer ${token}`,
        'Accept-Profile': 'hub',
      },
      cache: 'no-store',
    },
  );
  const linhas = membro.ok ? ((await membro.json()) as { role?: string }[]) : [];
  if (linhas[0]?.role !== 'admin') return recusa('nao-e-admin', 403);

  if (!serviceRoleKey) return recusa('sem-service-role', 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. A conta correspondente aqui. Sem ela não há para quem emitir sessão.
  const { data: perfil } = await admin
    .from('profiles')
    .select('email')
    .ilike('email', usuarioHub.email)
    .maybeSingle();
  if (!perfil?.email) return recusa('sem-conta', 404);

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: perfil.email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return recusa('falha-ao-emitir', 500);

  return NextResponse.json({ token_hash: tokenHash });
}

/**
 * Sonda de configuração: diz se a service_role está presente neste ambiente,
 * sem revelar valor nenhum. Serve para conferir o deploy sem precisar de uma
 * sessão de admin do Hub em mãos — a diferença entre "a ponte não está de pé"
 * e "a ponte está de pé e recusou você" é a primeira coisa que se quer saber.
 */
export async function GET() {
  return NextResponse.json({
    ponte: 'hub-entry',
    service_role: Boolean(serviceRoleKey),
    hub: HUB_URL,
  });
}
