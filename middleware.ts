import { NextRequest, NextResponse } from 'next/server';

/**
 * Proteção de acesso por HTTP Basic Auth (usuário + senha compartilhados).
 * Credenciais lidas das variáveis de ambiente BASIC_AUTH_USER / BASIC_AUTH_PASSWORD.
 *
 * Comportamento por ambiente:
 *  - produção: se as variáveis NÃO estiverem definidas, BLOQUEIA (fail-closed) — nunca
 *    expõe os dados confidenciais por configuração incompleta.
 *  - desenvolvimento: se não definidas, libera (para não atrapalhar o `npm run dev`).
 */
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        'Proteção de acesso não configurada (defina BASIC_AUTH_USER e BASIC_AUTH_PASSWORD).',
        { status: 503 }
      );
    }
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded); // Edge runtime expõe atob
      const idx = decoded.indexOf(':');
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Autenticação necessária.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Dashboard de Licitações Avantia", charset="UTF-8"',
    },
  });
}

// Protege todas as rotas, exceto assets internos do Next.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
