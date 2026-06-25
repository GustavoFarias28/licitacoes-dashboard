import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// Invalida o cache ISR da página '/' para que reloads / outros usuários vejam logo
// as escritas feitas pela interface. Chamado fire-and-forget após cada gravação.
export const runtime = 'nodejs';

export async function POST() {
  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
