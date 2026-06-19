# Dashboard de Licitações — Avantia

Dashboard de gestão de licitações em **Next.js (App Router)**, alimentado pelo **Supabase**
(Postgres) e publicado na **Vercel**. A visualização (KPIs, gráficos, tabela, Kanban,
calendário e análise de concorrência) reaproveita o layout original em HTML/Chart.js.

## Arquitetura

```
Supabase (tabela public.licitacoes)
        │  service_role key (somente servidor)
        ▼
app/page.tsx  ──fetchSnapshot()──▶ lib/snapshot.ts   (mapeia linha→record do dashboard)
   (Server Component, ISR 5 min)
        │ injeta os dados como <script type="application/json">
        ▼
components/Dashboard.tsx (client) ──▶ public/dashboard.js  (render reaproveitado)
                                  └─▶ public/chart.umd.js   (Chart.js 4.5.0, local)
```

- **Leitura server-side**: a `service_role` key nunca chega ao navegador.
- **ISR**: a página revalida a cada 5 min (`export const revalidate = 300` em `app/page.tsx`);
  novas linhas no Supabase aparecem automaticamente.
- **Proteção de acesso**: `middleware.ts` exige HTTP Basic Auth (fail-closed em produção).

## Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` (segredo; só servidor) |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | Login do dashboard (obrigatórios em produção) |

As mesmas variáveis devem ser cadastradas na Vercel (Settings → Environment Variables).

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção
```

## Dados

Tabela `public.licitacoes` (uma linha por edital). Colunas em `snake_case`; o campo
`op_link` guarda o hyperlink absoluto da pasta do projeto no SharePoint. O mapeamento
para o formato consumido pelo dashboard está em `lib/snapshot.ts`.
