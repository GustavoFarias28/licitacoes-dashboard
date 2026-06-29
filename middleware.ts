import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, sha256Hex } from '@/lib/auth';

/**
 * Proteção de acesso por senha única compartilhada.
 *
 * O fluxo: a página `/login` (campo único de senha) envia a senha para `/api/auth/login`, que valida
 * contra `ACCESS_PASSWORD` e grava o cookie `avantia_auth` (= SHA-256 da senha). Este middleware
 * compara o cookie com o hash esperado a cada request.
 *
 * Comportamento por ambiente quando `ACCESS_PASSWORD` NÃO está definida:
 *  - produção: BLOQUEIA (fail-closed) — nunca expõe os dados por configuração incompleta.
 *  - desenvolvimento: libera (para não atrapalhar o `npm run dev`).
 */

// Rotas liberadas sem cookie (senão não haveria como autenticar).
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const pass = process.env.ACCESS_PASSWORD;
  if (!pass) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        'Proteção de acesso não configurada (defina ACCESS_PASSWORD).',
        { status: 503 }
      );
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await sha256Hex(pass))) {
    return NextResponse.next();
  }

  // Não autenticado: API recebe 401 JSON (fetch do dashboard trata o erro);
  // navegação de página é redirecionada para a tela de login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

// Protege todas as rotas, exceto assets internos do Next.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
