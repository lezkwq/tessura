import { describe, expect, it } from 'vitest';
import { leadMarkdown } from '@/lib/lead-markdown';
import { NO_FEED_OBSERVATION, type AuditNotes } from '@/lib/audit-data';
import type { Business } from '@/lib/prospeccao';
import type { Audit } from '@/lib/abordagem';

const business = {
  id: 'b1', user_id: 'u1', place_id: 'ChIJx', city: 'florianópolis', state: 'SC', niche: 'açaí',
  website_type: 'sem site', is_lead: true, enrichment_status: 'ready', search_id: null,
  created_at: '', updated_at: '',
  data: { title: 'TAO AÇAÍ', categoryName: 'Loja de açaí', totalScore: 4.9, reviewsCount: 120, phoneUnformatted: '(48) 3123-4567', address: 'Rua Exemplo, 10' },
} as unknown as Business;

const audit = {
  id: 'a1', user_id: 'u1', business_id: 'b1', message: 'Olá, tudo bem? Mensagem de teste.', word_count: 6,
  status: 'não enviada', sent_at: null, created_at: '2026-10-22', updated_at: '2026-10-22',
  observations: ['A nota no Google é 4,9'], complement: 'Maps sem fotos', observation_state: [],
} as unknown as Audit;

const notes: AuditNotes = {
  complement: 'Maps sem fotos',
  observations: [
    { id: '1', text: 'A nota no Google é 4,9 com 120 avaliações', checked: true, source: 'Maps' },
    { id: '2', text: 'Observação não marcada', checked: false, source: 'Maps' },
    { id: '3', text: 'O perfil é @tao.acai', checked: true, source: 'Print', kind: 'Data' },
    { id: '4', text: 'Nas publicações visíveis no print há fotos de açaí', checked: true, source: 'Print', kind: 'Visual' },
    { id: '5', text: 'Visual não marcado', checked: false, source: 'Print', kind: 'Visual' },
    { id: '6', text: NO_FEED_OBSERVATION, checked: true, source: 'Print', kind: 'Visual' },
  ],
};

describe('Lead Markdown export', () => {
  const md = leadMarkdown(business, audit, notes);
  it('includes only checked observations and never the no-feed notice', () => {
    expect(md).toContain('A nota no Google é 4,9 com 120 avaliações');
    expect(md).toContain('Nas publicações visíveis no print há fotos de açaí');
    expect(md).not.toContain('Observação não marcada');
    expect(md).not.toContain('Visual não marcado');
    expect(md).not.toContain(NO_FEED_OBSERVATION);
    expect(md).not.toContain('Texto lido dos prints');
  });
  it('keeps complement, generated message and status', () => {
    expect(md).toContain('### Complemento');
    expect(md).toContain('Maps sem fotos');
    expect(md).toContain('### Mensagem atual');
    expect(md).toContain('Olá, tudo bem? Mensagem de teste.');
    expect(md).toContain('Status: não enviada');
  });
  it('reports Instagram user from prints instead of plain missing label', () => {
    expect(md).toContain('Instagram: a Apify não trouxe. Usuário informado nos prints: tao.acai');
    expect(md).toContain('A Apify não trouxe: E-mail');
  });
  it('falls back to the plain label when no print user exists', () => {
    const withoutUser = leadMarkdown(business, audit, { ...notes, observations: notes.observations.filter(o => o.id !== '3') });
    expect(withoutUser).toContain('A Apify não trouxe: Instagram');
  });
});
