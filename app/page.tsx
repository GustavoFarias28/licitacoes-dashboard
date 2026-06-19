import fs from 'node:fs';
import path from 'node:path';
import Dashboard from '@/components/Dashboard';
import { fetchSnapshot } from '@/lib/snapshot';

// ISR: regenera a página a cada 5 min. Novas linhas no Supabase aparecem
// automaticamente após o revalidate (ou via /api/revalidate no futuro).
export const revalidate = 300;

export default async function Page() {
  const snapshot = await fetchSnapshot();
  // Markup do dashboard original (extraído do index.html), lido no servidor.
  const bodyHtml = fs.readFileSync(path.join(process.cwd(), 'app', 'body.html'), 'utf-8');
  return <Dashboard snapshot={snapshot} bodyHtml={bodyHtml} />;
}
