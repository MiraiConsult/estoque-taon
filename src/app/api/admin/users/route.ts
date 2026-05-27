import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getAuthedClient(token: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function verifyAdmin(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const supabase = getAuthedClient(token);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? token : null;
}

export async function POST(request: NextRequest) {
  const token = await verifyAdmin(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, password, name, role } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 });
  }

  const adminClient = getAdminClient();

  if (adminClient) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0], role: role || 'operator' },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data.user });
  }

  // Fallback without service role key: signup + confirm via SQL workaround
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      data: { name: name || email.split('@')[0], role: role || 'operator' },
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: result.msg || result.message || result.error_description || 'Erro ao criar usuário' },
      { status: 400 }
    );
  }

  // User created but needs email confirmation - confirm via admin client or return success
  // The user will need to be confirmed manually if no service role key
  return NextResponse.json({ user: result, needsConfirmation: !serviceRoleKey });
}

export async function DELETE(request: NextRequest) {
  const token = await verifyAdmin(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('id');
  if (!userId) {
    return NextResponse.json({ error: 'ID do usuário obrigatório' }, { status: 400 });
  }

  const adminClient = getAdminClient();
  if (adminClient) {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  // Fallback: delete profile only
  const authed = getAuthedClient(token);
  await authed.from('profiles').delete().eq('id', userId);
  return NextResponse.json({ success: true });
}
