/**
 * Domínios de validação (fonte única).
 *
 * Estas listas são a verdade tanto para o SERVIDOR (validação nas rotas de escrita
 * em app/api/licitacoes) quanto para o CLIENTE (dropdowns do modal e do Board, que
 * leem estes valores via SNAPSHOT.domain — injetado por lib/snapshot.ts).
 *
 * IMPORTANTE: módulo PURO — sem 'server-only' e sem segredos. O conteúdo é
 * serializado e enviado ao navegador dentro do snapshot.
 *
 * Leitura tolerante: registros antigos podem conter valores fora destas listas
 * (ex.: comerciais que saíram do quadro). Eles continuam sendo exibidos; apenas
 * não são selecionáveis em novas edições, e a validação de escrita os rejeita.
 */

export const COMERCIAIS = ['N.D.A', 'Fábio', 'Carlos', 'Garrido'] as const;

export const CATEGORIAS = [
  'T.I.',
  'CFTV',
  'Controle de Acesso',
  'Áudio&Vídeo',
  'Data Center',
  'Videowall',
  'Tela Interativa',
  'Drone',
  'Cabeamento Estruturado',
] as const;

/** Ordem desejada das colunas do Kanban / dropdown de status. */
export const STATUS_ORDER = [
  'Em Análise',
  'Validação',
  'Não Participamos',
  'Vamos Participar',
  'Participamos',
  'Perdemos',
  'Ganhamos',
  'Aguardando Republicação',
] as const;

export const STATUS_COLORS: Record<string, string> = {
  'Em Análise': '#5278B5',
  'Validação': '#E88126',
  'Vamos Participar': '#0E2447',
  'Não Participamos': '#C4C7CD',
  'Perdemos': '#71757B',
  'Ganhamos': '#2E9E5B',
  'Aguardando Republicação': '#71757B',
  'Participamos': '#5278B5',
};

export const MOTIVOS_DECLINIO = [
  'Atestados',
  'Não trabalhado',
  'Falta de Parceiros',
  'Sem diferencial tecnológico',
  'Direcionamento de Fabricante',
  'Falta de R.O.',
  'V. Ref. Baixo',
  'Distanciamento do escopo',
  'Certificados',
  'Localização',
  'Índices financeiros insuficientes',
] as const;

/** Objeto único injetado no snapshot e lido pelo dashboard.js (SNAPSHOT.domain). */
export const DOMAIN = {
  comerciais: [...COMERCIAIS],
  categorias: [...CATEGORIAS],
  status: [...STATUS_ORDER],
  statusColors: STATUS_COLORS,
  motivosDeclinio: [...MOTIVOS_DECLINIO],
};

export type Domain = typeof DOMAIN;
