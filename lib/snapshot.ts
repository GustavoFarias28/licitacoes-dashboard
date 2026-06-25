import 'server-only';
import { getSupabaseServer } from './supabaseServer';
import { DOMAIN, type Domain } from './domain';
import {
  SELECT_COLUMNS,
  rowToRecord,
  type DashboardRecord,
  type LicitacaoRow,
} from './licitacaoMapping';

export type { DashboardRecord } from './licitacaoMapping';

export interface Snapshot {
  fetchedAt: string;
  sourcePath: string;
  records: DashboardRecord[];
  domain: Domain;
}

/** Busca todas as licitações no Supabase e converte para o formato do dashboard. */
export async function fetchSnapshot(): Promise<Snapshot> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('licitacoes')
    .select(SELECT_COLUMNS)
    .order('data_abertura', { ascending: true });

  if (error) {
    throw new Error('Erro ao buscar licitações no Supabase: ' + error.message);
  }

  const rows = (data ?? []) as unknown as LicitacaoRow[];
  const records: DashboardRecord[] = rows.map(rowToRecord);

  return {
    fetchedAt: new Date().toISOString(),
    sourcePath: 'Supabase: public.licitacoes',
    records,
    domain: DOMAIN,
  };
}
