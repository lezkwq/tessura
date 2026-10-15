import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assertOwner, type AppClient } from './apify.server';
import { askGemini } from './ai.server';
import { leadFacts, validateMessage, wordCount, type Rules } from './abordagem';

async function loadRules(db: AppClient, userId: string): Promise<Rules> {
  const found = await db.from('message_rules').select('*').eq('user_id', userId).maybeSingle();
  if (found.error) throw new Error(`Não foi possível carregar as regras. (${found.error.message})`);
  if (found.data) return found.data;
  const created = await db.from('message_rules').insert({ user_id: userId }).select().single();
  if (created.error || !created.data) throw new Error('Não foi possível criar as regras padrão.');
  return created.data;
}

export const getRules = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertOwner(context.supabase);
  return loadRules(context.supabase, context.userId);
});

const rulesSchema = z.object({
  instructions: z.string().trim().min(20).max(8000),
  min_words: z.number().int().min(1).max(500),
  max_words: z.number().int().min(1).max(500),
  opening: z.string().trim().min(1).max(40),
  signer: z.string().trim().min(1).max(60),
  banned_words: z.array(z.string().trim().min(1).max(80)).max(200),
}).refine((r) => r.min_words <= r.max_words, 'O mínimo precisa ser menor ou igual ao máximo.');

export const saveRules = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => rulesSchema.parse(i)).handler(async ({ data, context }) => {
  await assertOwner(context.supabase);
  const { data: saved, error } = await context.supabase.from('message_rules').upsert({ ...data, user_id: context.userId, updated_at: new Date().toISOString() }).select().single();
  if (error || !saved) throw new Error('Não foi possível salvar as regras.');
  return saved;
});

export const resetRules = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertOwner(context.supabase);
  await context.supabase.from('message_rules').delete().eq('user_id', context.userId);
  return loadRules(context.supabase, context.userId);
});

const imageSchema = z.string().regex(/^data:image\/(png|jpeg|webp);base64,/).max(7_000_000);
export const readPrints = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => z.object({ images: z.array(imageSchema).min(1).max(5) }).parse(i)).handler(async ({ data, context }) => {
  await assertOwner(context.supabase);
  const text = await askGemini([{
    role: 'user',
    content: [
      { type: 'text', text: 'Estes são prints do Instagram de uma empresa. Liste até 8 observações factuais e curtas, em português do Brasil, somente sobre o que está claramente visível (por exemplo: "o link da bio leva ao WhatsApp", "o último post é de 3 de maio"). Não deduza, não invente e não opine. Se algo não estiver legível, não cite. Responda apenas com uma observação por linha, sem numeração, sem marcadores, sem emoji e sem travessão. Se nada for legível, responda vazio.' },
      ...data.images.map((url) => ({ type: 'image' as const, image: url })),
    ],
  }]);
  return text.split('\n').map((l) => l.replace(/^[\s\-*•\d.)]+/, '').replace(/[—–]/g, ',').trim()).filter((l) => l.length > 3).slice(0, 8);
});

async function compose(db: AppClient, userId: string, businessId: string, observations: string[]) {
  const rules = await loadRules(db, userId);
  const { data: lead } = await db.from('businesses').select('*').eq('id', businessId).eq('is_lead', true).single();
  if (!lead) throw new Error('Lead não encontrado.');
  const facts = leadFacts(lead);
  const sources = [...facts, ...observations];
  const base = `${rules.instructions}\n\nAbertura obrigatória: ${rules.opening}\nQuem assina: ${rules.signer}\nEntre ${rules.min_words} e ${rules.max_words} palavras.\nPalavras proibidas: ${rules.banned_words.join(', ')}\n\nDados do lead:\n${facts.join('\n')}\n\nObservações marcadas:\n${observations.map((o) => `- ${o}`).join('\n')}\n\nResponda somente com o texto da mensagem.`;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prompt = lastErrors.length ? `${base}\n\nA tentativa anterior foi recusada porque ${lastErrors.join('; ')}. Corrija.` : base;
    const message = (await askGemini([{ role: 'user', content: prompt }])).replace(/^["']|["']$/g, '').trim();
    lastErrors = validateMessage(message, rules, sources);
    if (!lastErrors.length) return { message, words: wordCount(message) };
  }
  throw new Error(`A mensagem não passou na validação após 3 tentativas: ${lastErrors.join('; ')}.`);
}

const obsSchema = z.array(z.string().trim().min(1).max(300)).min(1).max(30);
export const generateMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => z.object({ id: z.string().uuid(), observations: obsSchema }).parse(i)).handler(async ({ data, context }) => {
  const db = context.supabase; await assertOwner(db);
  const { message, words } = await compose(db, context.userId, data.id, data.observations);
  const { data: audit, error } = await db.from('audits').insert({ user_id: context.userId, business_id: data.id, observations: data.observations, message, word_count: words }).select().single();
  if (error || !audit) throw new Error('Não foi possível salvar a auditoria.');
  return audit;
});

export const regenerateAudit = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
  const db = context.supabase; await assertOwner(db);
  const { data: audit } = await db.from('audits').select('*').eq('id', data.id).single();
  if (!audit) throw new Error('Auditoria não encontrada.');
  const { message, words } = await compose(db, context.userId, audit.business_id, audit.observations);
  const { data: saved, error } = await db.from('audits').update({ message, word_count: words, status: 'não enviada', sent_at: null, updated_at: new Date().toISOString() }).eq('id', audit.id).select().single();
  if (error || !saved) throw new Error('Não foi possível salvar a nova mensagem.');
  return saved;
});

export const markSent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
  await assertOwner(context.supabase);
  const { data: saved, error } = await context.supabase.from('audits').update({ status: 'enviada', sent_at: new Date().toISOString() }).eq('id', data.id).select().single();
  if (error || !saved) throw new Error('Não foi possível marcar como enviada.');
  return saved;
});

export const listAudits = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertOwner(context.supabase);
  const { data, error } = await context.supabase.from('audits').select('*, businesses(id,city,state,data)').order('created_at', { ascending: false });
  if (error) throw new Error(`Não foi possível carregar as auditorias. (${error.message})`);
  return data;
});
