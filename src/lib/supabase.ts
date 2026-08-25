import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * `detectSessionInUrl` desligado de propósito.
 *
 * Quem entra por dentro do MC Castro Hub chega com `#access_token=...` na URL,
 * no formato que o Supabase usa no retorno de magic link. Esse token é do
 * projeto do Hub, não deste — o supabase-js tentaria adotá-lo e falharia,
 * limpando a URL antes de a ponte conseguir lê-lo. Quem lê o fragmento é o
 * `consumirEntradaPeloHub()` em `lib/hubEntry.ts`; este app não tem nenhum
 * outro fluxo (magic link, OAuth, recuperação de senha) que dependa da URL.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { detectSessionInUrl: false },
});
