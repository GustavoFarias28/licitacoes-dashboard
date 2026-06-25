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

/** Atualiza uma licitação. Body: campos camelCase a alterar (PATCH parcial). */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 });

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
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('licitacoes')
    .update(row)
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Erro ao salvar no Supabase: ' + error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ record: rowToRecord(data as unknown as LicitacaoRow) });
}

/** Exclui uma licitação por id. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 });

  const sb = getSupabaseServer();
  const { error } = await sb.from('licitacoes').delete().eq('id', id);
  if (error) {
    return NextResponse.json(
      { error: 'Erro ao excluir no Supabase: ' + error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
