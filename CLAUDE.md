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
  filtros, modal). É o JS original **com uma única modificação**: a origem dos dados.

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

### Contrato Supabase ↔ dashboard (onde editar ao mudar dados)

`lib/snapshot.ts` é o único lugar que conhece o schema do banco. Mapeia colunas `snake_case` para o
record `camelCase` que o `dashboard.js` espera, e **deriva** campos que o dashboard usa mas não existem
no banco: `dataStr` (DD/MM/YYYY), `ano`, `mes` (0-11) — derivados por **fatiamento de string** da data
(NÃO via `new Date(...).getMonth()`, para não sofrer drift de fuso, já que a Vercel roda em UTC).
`categoria` vai cru (o dashboard faz o split por `;`/`/`). Se adicionar/renomear coluna no Supabase,
ajuste aqui.

`op_link` guarda a URL **absoluta** da pasta do projeto no SharePoint (`https://tiavantia.sharepoint.com/...`);
o dashboard a renderiza como link "OP «número»" na tabela, no Kanban e no modal. Linhas sem link → `null`.

### Acesso e atualização

- `middleware.ts`: HTTP Basic Auth (senha única compartilhada via env vars). **Fail-closed em produção**
  (se as vars não estiverem setadas, bloqueia em vez de expor). Em dev, libera sem as vars.
- Atualização dos dados: **ISR `revalidate = 300`** (5 min). Para refletir inserções na hora no futuro,
  o plano é um Route Handler `/api/revalidate` chamado pelo processo de ingestão (ainda não implementado).

## Pegadinhas

- **Editar a visualização** = mexer em `public/dashboard.js` / `app/globals.css` / `app/body.html`
  (vanilla, não React). Preserve os `id`s dos elementos. Esses arquivos refletem o `index.html` original;
  mudanças grandes idealmente sincronizam com a fonte.
- `app/body.html` é lido com `fs` em runtime → `next.config.mjs` tem `outputFileTracingIncludes` para
  empacotá-lo no deploy da Vercel. Se renomear/mover, atualize lá.
- A `service_role key` bypassa RLS e é **server-only** — nunca a exponha no client nem use prefixo
  `NEXT_PUBLIC_`. A tabela tem RLS habilitado sem policies (leitura só via servidor).
- O projeto vive **fora do OneDrive** de propósito (evita sync de `node_modules`/`.next`).
