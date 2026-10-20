import { beforeEach, expect, it, vi } from 'vitest';
const stream = vi.hoisted(() => vi.fn(() => ({ text: Promise.resolve('Olá') })));
vi.mock('ai', () => ({ streamText: stream }));
vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: () => () => 'existing-model' }));
import { askGemini } from '@/lib/ai.server';
beforeEach(() => { vi.stubEnv('LOVABLE_API_KEY', 'test-only'); stream.mockClear(); });
it('passes instructions separately, leaving only the user turn in messages', async () => {
  await askGemini([{ role: 'user', content: 'Maps sem fotos' }], 'Regras obrigatórias');
  expect(stream).toHaveBeenCalledWith(expect.objectContaining({ instructions: 'Regras obrigatórias', messages: [{ role: 'user', content: 'Maps sem fotos' }], maxRetries: 0 }));
});