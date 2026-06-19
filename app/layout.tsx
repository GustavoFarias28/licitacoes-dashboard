import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestão de Licitações — Avantia',
  description: 'Dashboard de gestão de licitações da Avantia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {/* Chart.js servido localmente; beforeInteractive garante window.Chart
            disponível antes do dashboard.js executar (deve ficar no root layout). */}
        <Script src="/chart.umd.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
