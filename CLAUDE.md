# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm install
npm run dev        # http://localhost:3000 (em dev, o middleware de auth fica liberado)
npm run build      # build de produção (pré-renderiza / com dados reais do Supabase)
npm start          # serve o build
npx tsc --noEmit   # checagem de tipos (use isto como "lint" — não há ESLint configurado)
```

Não há suíte de testes. A verificação padrão é `npx tsc --noEmit` + rodar `npm run dev`/`npm run build` e conferir a página.

Variáveis de ambiente (copie `.env.local.example` → `.env.local`; todas são lidas só no servidor):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`.

## Arquitetura — o ponto central a entender

**A UI do dashboard NÃO é React idiomático.** Ela é o dashboard original em HTML/CSS/JS *vanilla* +
Chart.js, reaproveitado quase intacto. Foi extraído de um `index.html` autocontido (que vive no projeto
irmão, fora deste repo) e dividido em três arquivos **que espelham aquele original**:

- `app/globals.css` — o `<style>` original, sem alteração.
- `app/body.html` — o markup do `<body>` original (sidebar, topbar, painéis, `<canvas>`s, tabela, modal).
  Os `id`s dos elementos são contrato: `public/dashboard.js` os busca por `getElementById`.
- `public/dashboard.js` — toda a lógica de render (KPIs, 7 gráficos, treemap SVG, Kanban, calendário,
  filtros, modal) **e de escrita** (modal editável: criar/editar/excluir; filtros cruzados clicáveis).
  Partiu do JS original; hoje a origem dos dados é o snapshot injetado e as mutações vão para as rotas `/api`.

### O "seam" de dados (a única costura entre Next.js e o dashboard original)

O JS original tinha os dados embutidos numa `const SNAPSHOT` hardcoded. Aqui essa linha foi trocada por:

```js
const SNAPSHOT = JSON.parse(document.getElementById('__SNAPSHOT__').textContent);
```

O servidor injeta os dados nesse `<script type="application/json" id="__SNAPSHOT__">`. Fluxo completo:

```
Supabase public.licitacoes
   │  (service_role — lib/supabaseServer.ts, lazy, import 'server-only')
   ▼
lib/snapshot.ts  fetchSnapshot(): SELECT + mapeia cada linha (snake_case) → "record" do dashboard (camelCase)
   ▼
app/page.tsx (Server Component, export const revalidate = 300)
   • await fetchSnapshot()
   • fs.readFileSync('app/body.html')   ← markup lido em runtime
   ▼
components/Dashboard.tsx ('use client')
   • injeta o JSON em <script id="__SNAPSHOT__"> (com escape de '<','>','&')
   • injeta body.html via dangerouslySetInnerHTML
   • <Script src="/dashboard.js" afterInteractive />
   ▼
public/dashboard.js renderiza no browser
```

Chart.js é servido localmente (`public/chart.umd.js`) e carregado em `app/layout.tsx` com
`strategy="beforeInteractive"` — isso garante `window.Chart` disponível **antes** de `dashboard.js`
executar (o render dá `new Chart(...)`). Não troque essa ordem.

### O caminho de ESCRITA (CRUD via interface)

O dashboard escreve de volta no Supabase por **Route Handlers** (nunca Supabase no client — a
service_role fica no servidor). Fluxo:

```
public/dashboard.js  apiPost/apiPatch/apiDelete  ──fetch──►  app/api/licitacoes(/[id])
   • atualiza state.records em memória (normalizeRecord)        • valida domínios (lib/domain.ts)
     + render() + triggerRevalidate()                          • mapeia camelCase→snake_case (lib/licitacaoMapping.ts)
                                                               • getSupabaseServer() (service_role)
```

- As rotas (`POST` coleção, `PATCH`/`DELETE` por `id`) ficam atrás do **mesmo Basic Auth** do
  `middleware.ts` (o `matcher` cobre `/api`); o `fetch` do browser reusa o header da sessão.
- `app/api/revalidate` (`revalidatePath('/')`) é disparado fire-and-forget após cada escrita para
  refletir a mudança em reloads/outros usuários.
- **`id` é a chave de UPDATE/DELETE** — tratado como **string** ponta a ponta (a coluna é inteira;
  string evita perda de precisão se virar bigint). Editar célula/modal manda só os campos alterados.

### Contrato Supabase ↔ dashboard (onde editar ao mudar dados)

`lib/licitacaoMapping.ts` é a **fonte única** do schema: `SELECT_COLUMNS`, `rowToRecord` (leitura,
usada por `lib/snapshot.ts`) e `validateInput` (escrita, usada pelas rotas). Mapeia `snake_case`↔
`camelCase` e **deriva** campos que o dashboard usa mas não existem no banco: `dataStr` (DD/MM/YYYY),
`horaStr`, `ano`, `mes` (0-11) — por **fatiamento de string** da data (NÃO via `new Date(...).getMonth()`,
para não sofrer drift de fuso). Na escrita, o inverso: `data_abertura` é montada por concatenação
(`YYYY-MM-DDTHH:MM:00`), **nunca** via `toISOString()`. `categoria` é multivalorada (`"A; B"`; o
dashboard faz o split por `;`/`/`). Se adicionar/renomear coluna no Supabase, ajuste aqui.

`lib/domain.ts` é a **fonte única dos domínios de validação** (comerciais, categorias, status,
statusColors, motivos de declínio). É validado no servidor E injetado no snapshot (`SNAPSHOT.domain`)
para popular os dropdowns — o `dashboard.js` lê de lá (com fallback). Mude as listas só aqui.

`op_link` guarda a URL **absoluta** da pasta do projeto no SharePoint (`https://tiavantia.sharepoint.com/...`);
o dashboard a renderiza como link "OP «número»" na tabela, no Kanban e no modal. Linhas sem link → `null`.

### Acesso e atualização

- `middleware.ts`: HTTP Basic Auth (senha única compartilhada via env vars). **Fail-closed em produção**
  (se as vars não estiverem setadas, bloqueia em vez de expor). Em dev, libera sem as vars.
- Atualização dos dados: **ISR `revalidate = 300`** (5 min) para inserções externas (ingestão). As
  escritas pela interface chamam `/api/revalidate` (já implementado) para propagar na hora; a sessão que
  escreveu já reflete via `state.records` em memória.

## Pegadinhas

- **Editar a visualização** = mexer em `public/dashboard.js` / `app/globals.css` / `app/body.html`
  (vanilla, não React). Preserve os `id`s dos elementos. Esses arquivos refletem o `index.html` original;
  mudanças grandes idealmente sincronizam com a fonte.
- `app/body.html` é lido com `fs` em runtime → `next.config.mjs` tem `outputFileTracingIncludes` para
  empacotá-lo no deploy da Vercel. Se renomear/mover, atualize lá.
- A `service_role key` bypassa RLS e é **server-only** — nunca a exponha no client nem use prefixo
  `NEXT_PUBLIC_`. A tabela tem RLS habilitado sem policies (leitura só via servidor).
- O projeto vive **fora do OneDrive** de propósito (evita sync de `node_modules`/`.next`).
