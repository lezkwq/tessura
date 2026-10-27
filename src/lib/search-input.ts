import countries from 'i18n-iso-countries';
import pt from 'i18n-iso-countries/langs/pt.json';
import en from 'i18n-iso-countries/langs/en.json';
import { z } from 'zod';

countries.registerLocale(pt);
countries.registerLocale(en);
export const emptySearchForm = { country: 'Brasil', location: '', niche: '' };
export function countryCode(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 2 && countries.isValid(name.toUpperCase())) return name.toUpperCase();
  return countries.getAlpha2Code(name, 'pt') ?? countries.getAlpha2Code(name, 'en');
}
export const searchInputSchema = z.object({
  country: z.string().trim().min(2).max(100).refine(value => Boolean(countryCode(value)), 'País não reconhecido. Use o nome do país ou seu código de duas letras.'),
  location: z.string().trim().min(2).max(200),
  niche: z.string().trim().min(2).max(120),
});
export function actorSearchInput(input: z.infer<typeof searchInputSchema>) {
  const code = countryCode(input.country);
  if (!code) throw new Error('País não reconhecido.');
  return { searchStringsArray: [input.niche], locationQuery: `${input.location}, ${input.country}`, countryCode: code.toLowerCase(), maxCrawledPlacesPerSearch: 120, maxReviews: 0, maxImages: 0, scrapeContacts: false };
}
/** Prefer the returned country. Legacy Brazilian records predate country metadata. */
export function leadCountry(data: Record<string, unknown>): string {
  for (const key of ['countryCode', 'country', 'searchCountry']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'Brasil';
}
export function isBrazil(value: string): boolean {
  return countryCode(value) === 'BR';
}