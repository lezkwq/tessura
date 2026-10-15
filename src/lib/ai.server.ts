import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, type ModelMessage } from 'ai';

const MODEL = 'google/gemini-3.8-flash';

export async function askGemini(messages: ModelMessage[]): Promise<string> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error('A chave do Lovable AI não está configurada.');
  let runId: string | undefined;
  const provider = createOpenAICompatible({
    name: 'lovable',
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    headers: { 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set('X-Lovable-AIG-Run-ID', runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get('X-Lovable-AIG-Run-ID') ?? undefined;
      if (!res.ok) {
        const msg: Record<number, string> = {
          402: 'Sem créditos de IA no workspace.',
          403: 'O acesso à IA foi negado para este workspace.',
          429: 'Muitas solicitações à IA. Aguarde um pouco e tente de novo.',
        };
        throw new Error(msg[res.status] ?? `A IA retornou um erro (${res.status}).`);
      }
      return res;
    },
  });
  let failure: unknown;
  const result = streamText({ model: provider(MODEL), messages, maxRetries: 0, onError: ({ error }) => { failure = error; } });
  let text: string;
  try { text = await result.text; } catch (e) { throw failure ?? e; }
  if (failure) throw failure;
  return text.trim();
}
