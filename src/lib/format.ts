/** Pure display helpers shared by the interface and the AI prompt facts. */
import type { Business } from './prospeccao';
import { placeData, weightedScore } from './prospeccao';

const connectors = new Set(['e', 'da', 'de', 'do', 'das', 'dos', 'em', 'a', 'o', 'para', 'com']);

function capitalize(word: string) {
  return word ? word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1) : word;
}

/** Converts all-caps names to normal case; keeps acronyms up to 3 letters uppercase. */
export function displayName(value: string): string {
  const letters = value.replace(/[^\p{L}]/gu, '');
  if (!letters || letters !== letters.toLocaleUpperCase('pt-BR')) return value;
  return value.split(/(\s+)/).map((word, i) => {
    if (/^\s+$/.test(word) || !word) return word;
    const lower = word.toLocaleLowerCase('pt-BR');
    if (i > 0 && connectors.has(lower)) return lower;
    const core = word.replace(/[^\p{L}]/gu, '');
    if (core.length >= 2 && core.length <= 3) return word;
    return capitalize(lower);
  }).join('');
}

/** "cuiabá" or "CUIABÁ" -> "Cuiabá"; connectors stay lowercase. */
export function displayCity(value: string): string {
  return value.toLocaleLowerCase('pt-BR').split(/(\s+)/).map((word, i) =>
    /^\s+$/.test(word) || (i > 0 && connectors.has(word)) ? word : capitalize(word)).join('');
}

export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "08:00 to 17:30" -> "das 08:00 às 17:30". */
export function formatHours(value: string): string {
  return value
    .replace(/(\d{1,2}:\d{2})\s*(?:to|–|-|a)\s*(\d{1,2}:\d{2})/gi, 'das $1 às $2')
    .replace(/\bOpen 24 hours\b/i, 'Aberto 24 horas')
    .replace(/\bClosed\b/i, 'Fechado');
}

/** Brazilian phone for display only, e.g. (65) 99303-3242. Unknown shapes are returned as received. */
export function formatPhone(value: string): string {
  let d = value.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

export function linkLabel(type: Business['website_type']): string {
  const labels: Record<string, string> = {
    'só Instagram': 'Abrir Instagram',
    'só Facebook': 'Abrir Facebook',
    'só WhatsApp': 'Abrir WhatsApp',
  };
  return labels[type] ?? 'Abrir link';
}

export function businessScore(b: Business): number {
  const d = placeData(b.data);
  return weightedScore(d['totalScore'], d['reviewsCount']);
}

/** Weighted score descending, unrated last, place id as a stable tie break. */
export function sortByScore<T extends Business>(rows: T[]): T[] {
  return [...rows].sort((a, b) => businessScore(b) - businessScore(a) || a.place_id.localeCompare(b.place_id));
}
