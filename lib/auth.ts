/**
 * Fonte única do esquema de autenticação por senha única.
 *
 * O acesso é protegido por uma senha compartilhada (`ACCESS_PASSWORD`). Ao acertar a senha em
 * `/login`, grava-se o cookie `avantia_auth` cujo valor é o SHA-256 (hex) da senha — nunca a senha
 * em texto puro. O `middleware.ts` recomputa esse hash e compara com o cookie a cada request.
 *
 * `sha256Hex` usa Web Crypto (`crypto.subtle`), disponível tanto no Edge runtime (middleware)
 * quanto no Node (route handler de login).
 */

export const AUTH_COOKIE = 'avantia_auth';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias, em segundos

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
