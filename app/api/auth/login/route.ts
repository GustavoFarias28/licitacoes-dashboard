import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, COOKIE_MAX_AGE, sha256Hex } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Valida a senha única e, se correta, grava o cookie de sessão. Body: { password }. */
export async function POST(req: NextRequest) {
  const expected = process.env.ACCESS_PASSWORD;
  if (!expected) {
    // Em dev sem senha configurada o middleware já libera tudo; aqui é só um caso de borda.
    return NextResponse.json({ ok: false, error: 'Acesso não configurado.' }, { status: 503 });
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  if (password !== expected) {
    return NextResponse.json({ ok: false, error: 'Senha incorreta.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await sha256Hex(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
