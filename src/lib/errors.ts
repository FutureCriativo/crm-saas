// Transforma erro do banco em frase para a pessoa. Mensagens que nós escrevemos no banco (P0001) aparecem como estão;
// o resto vira texto genérico (detalhe técnico não deve ir para a tela).
export function friendlyError(error: any, fallback = 'Não foi possível concluir agora. Tente novamente.'): string {
  if (!error) return fallback;
  const code = error.code as string | undefined;
  const msg = (error.message as string) || '';
  if (code === 'P0001') return msg;
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para fazer isso.';
  if (code === '23505') return 'Já existe um registro igual.';
  if (code === '23503') return 'Este registro está ligado a outros dados e não pode ser removido.';
  if (code === '23514') return 'Algum campo está com valor inválido.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Sem conexão com o servidor. Verifique a internet.';
  return fallback;
}
