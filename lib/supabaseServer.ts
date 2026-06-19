import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Cliente Supabase para uso EXCLUSIVO no servidor (Server Components / Route Handlers).
 * Usa a service_role key — bypassa RLS e NUNCA pode chegar ao navegador.
 * Criado de forma preguiçosa para não quebrar build/typecheck quando as envs ainda
 * não estão definidas (ex.: lint local sem .env.local).
 */
export function getSupabaseServer(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Variáveis de ambiente ausentes: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ' +
        '(copie .env.local.example para .env.local e preencha).'
    );
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
