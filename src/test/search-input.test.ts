import { describe, expect, it } from 'vitest';
import { actorSearchInput, emptySearchForm, leadCountry, searchInputSchema } from '@/lib/search-input';
import { whatsappLink, whatsappNumber } from '@/lib/abordagem';

describe('country-aware searches', () => {
  it('defaults and resets to Brasil', () => { expect(emptySearchForm).toEqual({ country: 'Brasil', location: '', niche: '' }); });
  it('preserves 120 results and avoids initial extras', () => { expect(actorSearchInput({ country: 'Brasil', location: 'Florianópolis, SC', niche: 'açaí' })).toEqual({ countryCode: 'br', locationQuery: 'Florianópolis, SC, Brasil', searchStringsArray: ['açaí'], maxCrawledPlacesPerSearch: 120, maxReviews: 0, maxImages: 0, scrapeContacts: false }); });
  it('accepts Portugal with its own location and country parameter', () => { expect(actorSearchInput({ country: 'Portugal', location: 'Lisboa', niche: 'açaí' }).countryCode).toBe('pt'); });
  it('rejects unknown countries rather than assuming Brazil', () => { expect(searchInputSchema.safeParse({ country: 'País inventado', location: 'Lisboa', niche: 'açaí' }).success).toBe(false); });
  it('uses the saved countryCode', () => { expect(leadCountry({ countryCode: 'PT' })).toBe('PT'); });
});
describe('country-aware WhatsApp links', () => {
  it('keeps Brazilian DDD and ninth digit without duplication', () => { expect(whatsappNumber('(48) 99123-4567', 'Brasil').number).toBe('5548991234567'); expect(whatsappNumber('+55 48 99123-4567', 'BR').number).toBe('5548991234567'); });
  it('never adds a ninth digit to an eight-digit subscriber number', () => { expect(whatsappNumber('(48) 3123-4567', 'Brasil').number).toBe('554831234567'); });
  it('keeps foreign digits without 55 and preserves message text', () => { const result = whatsappNumber('+351 912 345 678', 'Portugal'); expect(result.number).toBe('351912345678'); const url = new URL(whatsappLink(result.number ?? '', 'Olá, teste.')); expect(url.searchParams.get('phone')).toBe('351912345678'); expect(url.searchParams.get('text')).toBe('Olá, teste.'); });
  it('blocks a foreign number without an explicit country code', () => { expect(whatsappNumber('912345678', 'Portugal')).toEqual({ number: null, reason: 'Número sem código do país, confira antes de enviar' }); expect(whatsappNumber('351912345678', 'Portugal').number).toBeNull(); });
});