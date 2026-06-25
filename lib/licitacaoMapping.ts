import 'server-only';
import {
  COMERCIAIS,
  CATEGORIAS,
  STATUS_ORDER,
  MOTIVOS_DECLINIO,
} from './domain';

/**
 * Fonte ÚNICA do mapeamento entre a tabela public.licitacoes (snake_case) e o
 * "record" consumido pelo dashboard (camelCase). Usado tanto na LEITURA
 * (lib/snapshot.ts) quanto na ESCRITA (app/api/licitacoes/*).
 *
 * Mantém num só lugar: as colunas do SELECT, a conversão linha→record (com
 * derivação de data/ano/mes por slicing, evitando drift de fuso), a conversão
 * inversa record→linha e a validação dos domínios fechados.
 */

/** Formato de registro consumido pelo dashboard reaproveitado (public/dashboard.js). */
export interface DashboardRecord {
  id: string;
  nome: string;
  uf: string;
  objeto: string;
  data: string | null; // 'YYYY-MM-DD'
  dataStr: string; // 'DD/MM/YYYY'
  horaStr: string; // 'HH:MM' (vazio quando 00:00 ou ausente — registros antigos)
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

/** Linha crua da tabela public.licitacoes. */
export interface LicitacaoRow {
  id: string | number | null;
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

/** Colunas lidas no SELECT (inclui id — chave primária usada por UPDATE/DELETE). */
export const SELECT_COLUMNS =
  'id,nome,uf,objeto,data_abertura,valor_estimado,comercial,codigo,op,categorias,status,motivo_declinio,concorrentes,valor_final,fabricantes,observacoes,op_link';

/** Campos camelCase do record ↔ colunas snake_case (exceto data, tratada à parte). */
const FIELD_TO_COLUMN: Record<string, string> = {
  nome: 'nome',
  uf: 'uf',
  objeto: 'objeto',
  valorEstimado: 'valor_estimado',
  comercial: 'comercial',
  codigo: 'codigo',
  op: 'op',
  opLink: 'op_link',
  categoria: 'categorias',
  status: 'status',
  motivoDeclinio: 'motivo_declinio',
  concorrentes: 'concorrentes',
  valorFinal: 'valor_final',
  fabricantes: 'fabricantes',
  observacoes: 'observacoes',
};

/**
 * Deriva data/ano/mes/hora por fatiamento da string ISO (evita drift de fuso: o
 * servidor Vercel roda em UTC e new Date(...).getMonth() poderia deslocar a data).
 */
function deriveDate(dataAbertura: string | null) {
  if (!dataAbertura) return { data: null, dataStr: '', horaStr: '', ano: null, mes: null };
  const s = String(dataAbertura);
  const ymd = s.slice(0, 10); // 'YYYY-MM-DD'
  const yyyy = ymd.slice(0, 4);
  const mm = ymd.slice(5, 7);
  const dd = ymd.slice(8, 10);
  const hhmm = s.slice(11, 16); // 'HH:MM' ou ''
  const horaStr = hhmm && hhmm !== '00:00' ? hhmm : '';
  return {
    data: ymd,
    dataStr: `${dd}/${mm}/${yyyy}`,
    horaStr,
    ano: Number(yyyy),
    mes: Number(mm) - 1,
  };
}

function num(v: number | string | null): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Converte uma linha do banco no record camelCase do dashboard. */
export function rowToRecord(r: LicitacaoRow): DashboardRecord {
  const d = deriveDate(r.data_abertura);
  return {
    id: r.id === null || r.id === undefined ? '' : String(r.id),
    nome: r.nome ?? '',
    uf: r.uf ?? '',
    objeto: r.objeto ?? '',
    data: d.data,
    dataStr: d.dataStr,
    horaStr: d.horaStr,
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
}

const MAX_LEN = 5000;
const URL_RE = /^https?:\/\/.+/i;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^\d{2}:\d{2}$/;

/**
 * Monta a string wall-clock para data_abertura SEM usar new Date()/toISOString()
 * (que reintroduziria drift de fuso). Espelha o slicing da leitura.
 * Retorna: string p/ gravar, null p/ limpar, ou undefined se inválida.
 */
function buildDataAbertura(data: unknown, horaStr: unknown): string | null | undefined {
  if (data === null || data === '') return null;
  const ymd = String(data).slice(0, 10);
  if (!YMD_RE.test(ymd)) return undefined;
  const hh = typeof horaStr === 'string' && HHMM_RE.test(horaStr) ? horaStr : '00:00';
  return `${ymd}T${hh}:00`;
}

function normalizeCategoria(raw: unknown, errors: string[]): string | undefined {
  const parts = String(raw ?? '')
    .split(/[;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    if (!(CATEGORIAS as readonly string[]).includes(p)) {
      errors.push(`Categoria inválida: "${p}"`);
    }
  }
  return parts.join('; ');
}

export interface ValidationResult {
  errors: string[];
  row: Record<string, unknown>;
}

/**
 * Valida a entrada (camelCase, vinda do cliente) e produz a linha (snake_case) p/ o banco.
 * Só processa as chaves presentes na entrada — serve tanto p/ POST quanto p/ PATCH parcial.
 * Datas: se `data` OU `horaStr` vierem, o cliente deve enviar AMBAS (são uma única coluna).
 */
export function validateInput(input: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const row: Record<string, unknown> = {};

  const str = (v: unknown) => String(v ?? '').trim().slice(0, MAX_LEN);

  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'status': {
        const v = str(value);
        if (v && !(STATUS_ORDER as readonly string[]).includes(v)) {
          errors.push(`Status inválido: "${v}"`);
        }
        row.status = v || null;
        break;
      }
      case 'comercial': {
        const v = str(value);
        if (v && !(COMERCIAIS as readonly string[]).includes(v)) {
          errors.push(`Comercial inválido: "${v}"`);
        }
        row.comercial = v || null;
        break;
      }
      case 'motivoDeclinio': {
        const v = str(value);
        if (v && !(MOTIVOS_DECLINIO as readonly string[]).includes(v)) {
          errors.push(`Motivo de declínio inválido: "${v}"`);
        }
        row.motivo_declinio = v || null;
        break;
      }
      case 'categoria': {
        row.categorias = normalizeCategoria(value, errors);
        break;
      }
      case 'opLink': {
        const v = str(value);
        if (v && !URL_RE.test(v)) errors.push('Link da OP deve ser uma URL http(s) válida.');
        row.op_link = v || null;
        break;
      }
      case 'valorEstimado':
      case 'valorFinal': {
        const n = num(value as number | string | null);
        if (n !== null && (Number.isNaN(n) || n < 0)) {
          errors.push(`${key} deve ser um número ≥ 0.`);
        }
        row[FIELD_TO_COLUMN[key]] = n;
        break;
      }
      case 'uf': {
        row.uf = str(value).toUpperCase().slice(0, 2);
        break;
      }
      case 'nome':
      case 'objeto':
      case 'codigo':
      case 'op':
      case 'concorrentes':
      case 'fabricantes':
      case 'observacoes': {
        row[FIELD_TO_COLUMN[key]] = str(value) || null;
        break;
      }
      case 'data':
      case 'horaStr':
        // tratadas juntas abaixo
        break;
      default:
        // chave desconhecida: ignora silenciosamente (id, dataStr, ano, mes, etc.)
        break;
    }
  }

  if ('data' in input || 'horaStr' in input) {
    const built = buildDataAbertura(input.data, input.horaStr);
    if (built === undefined) {
      errors.push('Data inválida (esperado YYYY-MM-DD).');
    } else {
      row.data_abertura = built;
    }
  }

  return { errors, row };
}
