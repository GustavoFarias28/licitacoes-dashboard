import 'server-only';
import { getSupabaseServer } from './supabaseServer';

/** Formato de registro consumido pelo dashboard reaproveitado (public/dashboard.js). */
export interface DashboardRecord {
  nome: string;
  uf: string;
  objeto: string;
  data: string | null; // 'YYYY-MM-DD'
  dataStr: string; // 'DD/MM/YYYY'
  valorEstimado: number;
  comercial: string;
  codigo: string;
  op: string;
  opLink: string | null;
  categoria: string; // multivalorada (';' ou '/') — o dashboard faz o split
  status: string;
  motivoDeclinio: string;
  concorrentes: string;
  valorFinal: number | null;
  fabricantes: string;
  observacoes: string;
  ano: number | null;
  mes: number | null; // 0-11
}

export interface Snapshot {
  fetchedAt: string;
  sourcePath: string;
  records: DashboardRecord[];
}

/** Linha crua da tabela public.licitacoes. */
interface LicitacaoRow {
  nome: string | null;
  uf: string | null;
  objeto: string | null;
  data_abertura: string | null;
  valor_estimado: number | string | null;
  comercial: string | null;
  codigo: string | null;
  op: string | null;
  categorias: string | null;
  status: string | null;
  motivo_declinio: string | null;
  concorrentes: string | null;
  valor_final: number | string | null;
  fabricantes: string | null;
  observacoes: string | null;
  op_link: string | null;
}

/**
 * Deriva data/ano/mes por fatiamento da string ISO (evita drift de fuso: o servidor
 * Vercel roda em UTC e new Date(...).getMonth() poderia deslocar a data).
 */
function deriveDate(dataAbertura: string | null) {
  if (!dataAbertura) return { data: null, dataStr: '', ano: null, mes: null };
  const ymd = String(dataAbertura).slice(0, 10); // 'YYYY-MM-DD'
  const yyyy = ymd.slice(0, 4);
  const mm = ymd.slice(5, 7);
  const dd = ymd.slice(8, 10);
  return {
    data: ymd,
    dataStr: `${dd}/${mm}/${yyyy}`,
    ano: Number(yyyy),
    mes: Number(mm) - 1,
  };
}

function num(v: number | string | null): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Busca todas as licitações no Supabase e converte para o formato do dashboard. */
export async function fetchSnapshot(): Promise<Snapshot> {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('licitacoes')
    .select(
      'nome,uf,objeto,data_abertura,valor_estimado,comercial,codigo,op,categorias,status,motivo_declinio,concorrentes,valor_final,fabricantes,observacoes,op_link'
    )
    .order('data_abertura', { ascending: true });

  if (error) {
    throw new Error('Erro ao buscar licitações no Supabase: ' + error.message);
  }

  const rows = (data ?? []) as LicitacaoRow[];
  const records: DashboardRecord[] = rows.map((r) => {
    const d = deriveDate(r.data_abertura);
    return {
      nome: r.nome ?? '',
      uf: r.uf ?? '',
      objeto: r.objeto ?? '',
      data: d.data,
      dataStr: d.dataStr,
      valorEstimado: num(r.valor_estimado) ?? 0,
      comercial: r.comercial ?? '',
      codigo: r.codigo ?? '',
      op: r.op ?? '',
      opLink: r.op_link ?? null,
      categoria: r.categorias ?? '',
      status: r.status ?? '',
      motivoDeclinio: r.motivo_declinio ?? '',
      concorrentes: r.concorrentes ?? '',
      valorFinal: num(r.valor_final),
      fabricantes: r.fabricantes ?? '',
      observacoes: r.observacoes ?? '',
      ano: d.ano,
      mes: d.mes,
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    sourcePath: 'Supabase: public.licitacoes',
    records,
  };
}
