import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// SOMENTE SERVIDOR. Nada desta pasta pode ser importado por componentes de tela.
if (typeof window !== 'undefined') throw new Error('src/server/* não pode rodar no navegador.');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message || 'Dados inválidos.' }, { status: 400 });
  console.error('[api] erro inesperado:', e instanceof Error ? e.message : 'desconhecido'); // nunca loga senha/token
  return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new ApiError(400, 'Requisição inválida.'); }
}
