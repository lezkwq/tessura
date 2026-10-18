import { describe, expect, it } from 'vitest';
import { validateMessage, whatsappLink, whatsappNumber, type Rules } from '@/lib/abordagem';

const rules: Rules = { user_id: 'test', updated_at: '', instructions: '', opening: 'Oi', signer: 'Leandro', min_words: 1, max_words: 100, banned_words: ['garantido'] };
const errors = (message: string, sources: string[] = []) => validateMessage(message, rules, sources);
describe('Source-grounded outreach', () => {
  it('accepts 2 only in 2 minutos without a source', () => {
    expect(errors('Oi, Leandro. Posso explicar em 2 minutos?')).toEqual([]);
    expect(errors('Oi, Leandro. Vocês têm 2 lojas.')).toContainEqual(expect.stringContaining('números'));
    expect(errors('Oi, Leandro. 2 lojas, em 2 minutos?')).toContainEqual(expect.stringContaining('números'));
    expect(errors('Oi, Leandro. 2 lojas.', ['2 lojas'])).toEqual([]);
  });
  it('rejects quarenta e dois unless 42 is present in sources', () => {
    expect(errors('Oi, Leandro. Quarenta e dois clientes.')).toContainEqual(expect.stringContaining('números'));
    expect(errors('Oi, Leandro. Quarenta e dois clientes.', ['42 clientes'])).toEqual([]);
  });
  it('normalizes compound, scaled and decimal written numbers', () => {
    expect(errors('Oi, Leandro. Mil duzentas e vinte avaliações.', ['1220 avaliações'])).toEqual([]);
    expect(errors('Oi, Leandro. Quatro vírgula oito de nota.', ['4.8'])).toEqual([]);
    expect(errors('Oi, Leandro. Duzentas avaliações.', ['200'])).toEqual([]);
    expect(errors('Oi, Leandro. Dois mil clientes.', ['2'])).toContainEqual(expect.stringContaining('números'));
    expect(errors('Oi, Leandro. Quarenta e dois.', ['quarenta e dois'])).toEqual([]);
  });
  it.each([
    ['Olá, Leandro.', 'começa'], ['Oi, Leandro 👋', 'emoji'], ['Oi, Leandro www.exemplo.com', 'link'],
    ['Oi, Leandro R$ 50', 'preço'], ['Oi, Leandro — tudo bem?', 'travessão'],
    ['Oi, tudo bem?', 'menciona'], ['Oi, Leandro garantido', 'proibidas'],
  ])('rejects prohibited content: %s', (message, reason) => expect(errors(message)).toContainEqual(expect.stringContaining(reason)));
  it('enforces configured word limits', () => expect(validateMessage('Oi Leandro', { ...rules, min_words: 3 }, [])).toContainEqual(expect.stringContaining('intervalo')));
  it('prefixes 55 without inventing digits and encodes the exact message', () => {
    expect(whatsappNumber('(65) 99123-4567').number).toBe('5565991234567');
    expect(whatsappNumber('+55 65 3123-4567').number).toBe('556531234567');
    const message = 'Oi, Leandro. Avaliações & atenção?\nPosso explicar em 2 minutos?';
    const url = new URL(whatsappLink('556531234567', message));
    expect(url.searchParams.get('phone')).toBe('556531234567');
    expect(url.searchParams.get('text')).toBe(message);
    expect(url.href).toContain(encodeURIComponent(message));
  });
});