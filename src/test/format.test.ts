import { describe, expect, it } from 'vitest';
import type { Business } from '@/lib/prospeccao';
import { displayCity, displayName, formatHours, formatPhone, formatRating, linkLabel, plural, sortByScore } from '@/lib/format';
import { validateMessage, whatsappLink, whatsappNumber, type Rules } from '@/lib/abordagem';

const biz = (place_id: string, totalScore?: number, reviewsCount?: number) =>
  ({ place_id, data: { totalScore, reviewsCount } }) as unknown as Business;

describe('weighted ranking (nota * avaliações + 4,0 * 10) / (avaliações + 10)', () => {
  it('puts 5,0 with 20 reviews above 5,0 with 14, unrated last', () => {
    const rows = [biz('rvs', 5, 14), biz('sem-nota'), biz('solucao', 5, 20), biz('media', 4.2, 300)];
    expect(sortByScore(rows).map((b) => b.place_id)).toEqual(['solucao', 'rvs', 'media', 'sem-nota']);
  });
});

describe('WhatsApp number', () => {
  it('does not duplicate 55 when Maps already returns +55', () => {
    expect(whatsappNumber('+5565993033242').number).toBe('5565993033242');
    expect(whatsappNumber('+55 65 99303-3242').number).toBe('5565993033242');
    expect(whatsappNumber('5565993033242').number).toBe('5565993033242');
    expect(whatsappNumber('(65) 99303-3242').number).toBe('5565993033242');
    expect(new URL(whatsappLink('5565993033242', 'Oi')).searchParams.get('phone')).toBe('5565993033242');
  });
});

describe('display text', () => {
  it('formats names, cities, ratings, hours, phones, plurals and link labels', () => {
    expect(displayName('LL CLIMATIZAÇÃO E ENERGIA SOLAR')).toBe('LL Climatização e Energia Solar');
    expect(displayName('Já Normal Ltda')).toBe('Já Normal Ltda');
    expect(displayCity('cuiabá')).toBe('Cuiabá');
    expect(formatRating(4.9)).toBe('4,9');
    expect(formatHours('08:00 to 17:30')).toBe('das 08:00 às 17:30');
    expect(formatPhone('+5565993033242')).toBe('(65) 99303-3242');
    expect(plural(1, 'lead salvo', 'leads salvos')).toBe('1 lead salvo');
    expect(plural(2, 'auditoria', 'auditorias')).toBe('2 auditorias');
    expect(linkLabel('só Instagram')).toBe('Abrir Instagram');
    expect(linkLabel('só link na bio')).toBe('Abrir link');
  });
  it('treats 4,9 and 4.9 as the same number', () => {
    const rules = { user_id: 't', updated_at: '', instructions: '', opening: 'Oi', signer: 'Leandro', min_words: 1, max_words: 100, banned_words: [] } as Rules;
    expect(validateMessage('Oi, Leandro. Nota 4,9 no Google.', rules, ['Nota no Google: 4.9'])).toEqual([]);
    expect(validateMessage('Oi, Leandro. Nota 4.9 no Google.', rules, ['Nota no Google: 4,9'])).toEqual([]);
  });
});
