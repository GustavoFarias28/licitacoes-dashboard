'use client';

import Script from 'next/script';
import type { Snapshot } from '@/lib/snapshot';

/**
 * Serializa o snapshot para embutir com segurança dentro de <script type="application/json">.
 * Escapa '<', '>' e '&' como sequências unicode (válidas em JSON) para que um possível
 * '</script>' nos dados não quebre a tag. JSON.parse no cliente reverte para os caracteres.
 */
function serializeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(snapshot)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export default function Dashboard({
  snapshot,
  bodyHtml,
}: {
  snapshot: Snapshot;
  bodyHtml: string;
}) {
  const json = serializeSnapshot(snapshot);

  return (
    <>
      {/* Dados injetados pelo servidor; lidos por public/dashboard.js via JSON.parse. */}
      <script
        id="__SNAPSHOT__"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: json }}
      />

      {/* Markup do dashboard original (sidebar, topbar, painéis, canvases, tabela, modal). */}
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />

      {/* Lógica de render reaproveitada. Chart.js já foi carregado (beforeInteractive no layout). */}
      <Script src="/dashboard.js" strategy="afterInteractive" />
    </>
  );
}
