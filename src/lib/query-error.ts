/** Show useful diagnostics without displaying credentials or an HTML error page. */
export function queryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message.trim()) return 'O servidor não informou o motivo da falha.';
  if (/<(?:!doctype|html|script|body)\b/i.test(message)) return 'O servidor devolveu uma página de erro, sem detalhes disponíveis.';
  return message
    .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [oculto]')
    .replace(/\b(?:apify_api_|sb_secret_|sb_publishable_|sk-|ghp_|github_pat_)[A-Za-z0-9_-]+/g, '[oculto]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g, '[oculto]')
    .replace(/([\w-]*(?:secret|token|password|senha|api[_-]?key|service[_-]?role)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[oculto]')
    .slice(0, 700);
}

export const diagnosticFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const html = response.headers.get('content-type')?.includes('text/html');
    throw new Error('O servidor respondeu com erro ' + response.status + '.' + (html ? ' Devolveu uma página de erro em vez dos dados.' : ''));
  }
  return response;
};
