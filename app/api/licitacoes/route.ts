import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import {
  validateInput,
  rowToRecord,
  SELECT_COLUMNS,
  type LicitacaoRow,
} from '@/lib/licitacaoMapping';

// service_role + 'server-only' exigem runtime Node (não Edge). Sem cache.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cria uma licitação. Body: campos camelCase. */
export async function POST(req: NextRequest) {
  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  const { errors, row } = validateInput(input);
  if (errors.length) {
    return NextResponse.json({ error: errors.join('; '), errors }, { status: 400 });
  }

  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('licitacoes')
    .insert(row)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Erro ao criar no Supabase: ' + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ record: rowToRecord(data as unknown as LicitacaoRow) }, { status: 201 });
}
